from __future__ import annotations

import hashlib
import html
import json
import re
import zipfile
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any

from app.database import Repository, utc_now
from app.services.llm import GeneratedProject, ModelError, OpenAICompatibleModel

ProgressCallback = Callable[[str, str], Awaitable[None]]


class BuildValidationError(RuntimeError):
    """Generated output violates the Frozen Core builder contract."""


@dataclass(slots=True)
class BuildResult:
    build_id: str
    summary: str
    artifact_path: Path
    preview_path: Path
    files: list[str]
    generator: str


class FactoryBuilder:
    """Plans, validates, writes, and packages a static web project."""

    SECRET_PATTERNS = (
        re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", re.IGNORECASE),
        re.compile(
            r"(?:api[_-]?key|access[_-]?token|secret)\s*[:=]\s*['\"][A-Za-z0-9_\-]{20,}",
            re.IGNORECASE,
        ),
        re.compile(r"\bsk-[A-Za-z0-9_\-]{20,}\b"),
    )

    def __init__(
        self,
        repository: Repository,
        workspace: Path,
        frozen_core: dict[str, Any],
        core_digest: str,
        model: OpenAICompatibleModel,
    ) -> None:
        self.repository = repository
        self.workspace = workspace
        self.frozen_core = frozen_core
        self.core_digest = core_digest
        self.model = model
        self.contract = frozen_core["builder_contract"]

    async def run(
        self,
        build_id: str,
        prompt: str,
        on_progress: ProgressCallback,
    ) -> BuildResult:
        await self._stage(
            build_id,
            "understand",
            "Reading the request and applying the Frozen Core constraints",
            on_progress,
        )
        project_kind = self._project_kind(prompt)

        await self._stage(
            build_id,
            "plan",
            f"Planning a responsive {project_kind} experience",
            on_progress,
        )

        await self._stage(
            build_id,
            "generate",
            "Generating the project files",
            on_progress,
        )
        generated: GeneratedProject
        if self.model.configured:
            try:
                generated = await self.model.generate_project(prompt, self.frozen_core)
            except ModelError:
                await on_progress(
                    "generate",
                    "The connected model was unavailable; using the safe local generator",
                )
                generated = self._local_project(prompt, project_kind)
        else:
            generated = self._local_project(prompt, project_kind)

        await self._stage(
            build_id,
            "validate",
            "Checking paths, file sizes, secrets, and required files",
            on_progress,
        )
        files = self.validate_files(generated.files)

        build_root = (self.workspace / build_id).resolve()
        project_root = build_root / "project"
        self._assert_workspace_path(build_root)
        project_root.mkdir(parents=True, exist_ok=False)

        for relative_path, content in files.items():
            destination = (project_root / relative_path).resolve()
            if not destination.is_relative_to(project_root):
                raise BuildValidationError(f"Unsafe output path: {relative_path}")
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(content, encoding="utf-8")

        manifest = {
            "schema": "hoolulu.factory.build/v1",
            "build_id": build_id,
            "created_at": utc_now(),
            "generator": generated.generator,
            "frozen_core": {
                "version": self.frozen_core["version"],
                "sha256": self.core_digest,
            },
            "request": {
                "sha256": hashlib.sha256(prompt.encode("utf-8")).hexdigest(),
                "summary": self._redact(prompt)[:240],
            },
            "files": sorted(files),
        }
        (project_root / "factory-manifest.json").write_text(
            json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
        )

        await self._stage(
            build_id,
            "package",
            "Packaging a clean, downloadable artifact",
            on_progress,
        )
        artifact_path = build_root / f"hoolulu-build-{build_id[:8]}.zip"
        with zipfile.ZipFile(artifact_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for file_path in sorted(project_root.rglob("*")):
                if file_path.is_file():
                    archive.write(file_path, file_path.relative_to(project_root))

        result = BuildResult(
            build_id=build_id,
            summary=generated.summary,
            artifact_path=artifact_path,
            preview_path=project_root,
            files=[*sorted(files), "factory-manifest.json"],
            generator=generated.generator,
        )
        self.repository.update_build(
            build_id,
            status="completed",
            stage="completed",
            summary=result.summary,
            artifact_path=str(artifact_path),
            preview_path=str(project_root),
            error=None,
        )
        await on_progress("completed", "Build complete and ready to preview")
        return result

    async def _stage(
        self,
        build_id: str,
        stage: str,
        detail: str,
        callback: ProgressCallback,
    ) -> None:
        self.repository.update_build(build_id, status="running", stage=stage)
        await callback(stage, detail)

    def validate_files(self, candidate: dict[str, str]) -> dict[str, str]:
        if not candidate:
            raise BuildValidationError("Generator returned no files")
        if len(candidate) > int(self.contract["maximum_files"]):
            raise BuildValidationError("Generated project contains too many files")

        reserved = {item.lower() for item in self.contract["reserved_paths"]}
        maximum_file = int(self.contract["maximum_file_bytes"])
        maximum_project = int(self.contract["maximum_project_bytes"])
        normalized: dict[str, str] = {}
        total_size = 0

        for raw_path, content in candidate.items():
            if not isinstance(raw_path, str) or not isinstance(content, str):
                raise BuildValidationError("Generated paths and contents must be text")
            raw_path = raw_path.replace("\\", "/").strip()
            path = PurePosixPath(raw_path)
            if path.is_absolute() or not path.parts or any(part in {"", ".", ".."} for part in path.parts):
                raise BuildValidationError(f"Unsafe output path: {raw_path}")
            if any(part.lower() in reserved for part in path.parts):
                raise BuildValidationError(f"Reserved output path: {raw_path}")
            if path.name.lower().startswith(".env"):
                raise BuildValidationError(f"Environment files are not allowed: {raw_path}")

            normalized_path = path.as_posix()
            if normalized_path in normalized:
                raise BuildValidationError(f"Duplicate output path: {normalized_path}")

            encoded_size = len(content.encode("utf-8"))
            if encoded_size > maximum_file:
                raise BuildValidationError(f"Generated file is too large: {normalized_path}")
            total_size += encoded_size
            if total_size > maximum_project:
                raise BuildValidationError("Generated project is too large")
            for pattern in self.SECRET_PATTERNS:
                if pattern.search(content):
                    raise BuildValidationError(
                        f"Possible secret material detected in {normalized_path}"
                    )
            normalized[normalized_path] = content

        for required in self.contract["required_web_files"]:
            if required not in normalized:
                raise BuildValidationError(f"Required file is missing: {required}")
        if "<html" not in normalized["index.html"].lower():
            raise BuildValidationError("index.html does not appear to be an HTML document")
        return normalized

    def _assert_workspace_path(self, path: Path) -> None:
        workspace = self.workspace.resolve()
        workspace.mkdir(parents=True, exist_ok=True)
        if not path.is_relative_to(workspace):
            raise BuildValidationError("Build path escaped the configured workspace")

    @classmethod
    def _redact(cls, value: str) -> str:
        redacted = " ".join(value.strip().split())
        for pattern in cls.SECRET_PATTERNS:
            redacted = pattern.sub("[REDACTED]", redacted)
        return redacted

    @staticmethod
    def _project_kind(prompt: str) -> str:
        lower = prompt.lower()
        if any(word in lower for word in ("shop", "store", "ecommerce", "e-commerce", "product")):
            return "storefront"
        if any(word in lower for word in ("dashboard", "analytics", "admin", "metrics")):
            return "dashboard"
        if any(word in lower for word in ("portfolio", "resume", "photographer", "designer")):
            return "portfolio"
        if any(word in lower for word in ("restaurant", "cafe", "menu", "bakery")):
            return "hospitality site"
        if any(word in lower for word in ("saas", "startup", "landing", "waitlist")):
            return "product landing page"
        return "web app"

    def _local_project(self, prompt: str, project_kind: str) -> GeneratedProject:
        clean_prompt = self._redact(prompt)
        title = self._title_from_prompt(clean_prompt)
        safe_title = html.escape(title)
        safe_prompt = html.escape(clean_prompt[:320])
        kind_label = project_kind.title()
        features = self._features_for(project_kind)
        feature_markup = "\n".join(
            f"""<article class="feature-card reveal">
              <span class="feature-number">0{index}</span>
              <h3>{html.escape(name)}</h3>
              <p>{html.escape(description)}</p>
            </article>"""
            for index, (name, description) in enumerate(features, start=1)
        )

        index_html = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="{safe_prompt}" />
    <title>{safe_title}</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <header class="site-header">
      <a class="brand" href="#top" aria-label="{safe_title} home">
        <span class="brand-mark" aria-hidden="true">H</span>
        <span>{safe_title}</span>
      </a>
      <button class="menu-button" aria-label="Toggle navigation" aria-expanded="false">Menu</button>
      <nav class="site-nav" aria-label="Main navigation">
        <a href="#story">Story</a>
        <a href="#features">Features</a>
        <a href="#contact">Contact</a>
      </nav>
      <a class="button button-small" href="#contact">Get started</a>
    </header>

    <main id="top">
      <section class="hero">
        <div class="eyebrow"><span></span> {kind_label} · Built by Hoolulu</div>
        <h1>{safe_title}<br /><em>made remarkable.</em></h1>
        <p class="hero-copy">{safe_prompt}</p>
        <div class="hero-actions">
          <a class="button" href="#features">Explore the experience</a>
          <a class="text-link" href="#story">See our approach <span>↗</span></a>
        </div>
        <div class="hero-visual" aria-label="Abstract product preview">
          <div class="orb orb-one"></div>
          <div class="orb orb-two"></div>
          <div class="preview-card preview-main">
            <div class="preview-top"><span></span><span></span><span></span></div>
            <div class="preview-content">
              <p>Designed for what’s next</p>
              <strong>{safe_title}</strong>
              <div class="preview-line"></div>
              <div class="preview-line short"></div>
            </div>
          </div>
          <div class="floating-note">Thoughtful by default <span>✦</span></div>
        </div>
      </section>

      <section class="statement" id="story">
        <p class="section-label">The idea</p>
        <h2>Useful should still feel <em>unforgettable.</em></h2>
        <p>We combine a focused experience with expressive details—giving every visitor a clear next step without losing the personality that makes the product distinct.</p>
      </section>

      <section class="features" id="features">
        <div class="section-heading">
          <div><p class="section-label">What matters</p><h2>A stronger starting point.</h2></div>
          <p>Built around clarity, momentum, and a responsive system that feels at home on every screen.</p>
        </div>
        <div class="feature-grid">{feature_markup}</div>
      </section>

      <section class="cta" id="contact">
        <div>
          <p class="section-label">Ready when you are</p>
          <h2>Turn the next idea<br />into something real.</h2>
        </div>
        <button class="button button-light" id="primary-action">Start a conversation</button>
      </section>
    </main>

    <footer>
      <a class="brand" href="#top"><span class="brand-mark">H</span><span>{safe_title}</span></a>
      <p>Built with Hoolulu Factory · <span id="year"></span></p>
    </footer>
    <script src="app.js"></script>
  </body>
</html>
"""

        styles = """:root {
  --ink: #191a17;
  --paper: #f4f1e9;
  --lime: #d7ff57;
  --violet: #7967ff;
  --line: rgba(25, 26, 23, .14);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--ink);
  background: var(--paper);
  font-synthesis: none;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; min-width: 320px; overflow-x: hidden; }
a { color: inherit; text-decoration: none; }
button, a { -webkit-tap-highlight-color: transparent; }
.site-header { height: 82px; padding: 0 4vw; display: flex; align-items: center; gap: 36px; border-bottom: 1px solid var(--line); position: relative; z-index: 10; }
.brand { display: inline-flex; align-items: center; gap: 10px; font-weight: 750; letter-spacing: -.03em; }
.brand-mark { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 50%; color: white; background: var(--ink); font-size: 14px; }
.site-nav { display: flex; gap: 28px; margin: auto; font-size: 14px; }
.site-nav a { opacity: .68; transition: opacity .2s; }
.site-nav a:hover { opacity: 1; }
.button { border: 1px solid var(--ink); background: var(--ink); color: white; border-radius: 999px; min-height: 50px; padding: 0 24px; display: inline-flex; align-items: center; justify-content: center; font: inherit; font-size: 14px; font-weight: 650; cursor: pointer; transition: transform .2s, box-shadow .2s; }
.button:hover { transform: translateY(-2px); box-shadow: 0 9px 25px rgba(25,26,23,.16); }
.button-small { min-height: 40px; padding: 0 18px; }
.menu-button { display: none; background: none; border: 0; font: inherit; }
.hero { min-height: calc(100vh - 82px); padding: 11vh 7vw 7vh; position: relative; }
.eyebrow, .section-label { text-transform: uppercase; letter-spacing: .13em; font-size: 11px; font-weight: 750; }
.eyebrow { display: flex; align-items: center; gap: 10px; }
.eyebrow span { width: 8px; height: 8px; background: var(--violet); border-radius: 50%; }
h1 { max-width: 930px; margin: 30px 0 24px; font-size: clamp(58px, 9vw, 132px); line-height: .86; letter-spacing: -.075em; font-weight: 720; }
em { font-family: Georgia, "Times New Roman", serif; font-weight: 400; }
.hero-copy { max-width: 510px; font-size: clamp(17px, 2vw, 21px); line-height: 1.55; color: rgba(25,26,23,.66); }
.hero-actions { display: flex; align-items: center; gap: 27px; margin-top: 35px; }
.text-link { font-size: 14px; font-weight: 650; }
.text-link span { margin-left: 5px; }
.hero-visual { position: absolute; width: min(39vw, 550px); height: min(34vw, 470px); right: 5vw; bottom: 5vh; }
.orb { position: absolute; border-radius: 50%; filter: blur(1px); }
.orb-one { width: 65%; aspect-ratio: 1; background: var(--lime); right: 3%; top: 4%; }
.orb-two { width: 42%; aspect-ratio: 1; background: var(--violet); left: 0; bottom: 0; opacity: .9; }
.preview-card { position: absolute; background: rgba(255,255,255,.84); backdrop-filter: blur(15px); border: 1px solid rgba(255,255,255,.8); box-shadow: 0 30px 80px rgba(25,26,23,.18); }
.preview-main { width: 72%; height: 70%; top: 15%; left: 14%; border-radius: 17px; transform: rotate(-4deg); }
.preview-top { height: 42px; border-bottom: 1px solid var(--line); display: flex; align-items: center; gap: 5px; padding: 0 14px; }
.preview-top span { width: 6px; height: 6px; border-radius: 50%; background: rgba(25,26,23,.3); }
.preview-content { padding: 12%; }
.preview-content p { text-transform: uppercase; letter-spacing: .12em; font-size: 8px; opacity: .45; }
.preview-content strong { display: block; margin: 15px 0 40px; font-size: clamp(24px, 3vw, 44px); letter-spacing: -.06em; line-height: 1; }
.preview-line { height: 7px; border-radius: 5px; background: rgba(25,26,23,.1); margin: 9px 0; }
.preview-line.short { width: 67%; }
.floating-note { position: absolute; right: 0; bottom: 7%; background: var(--ink); color: white; padding: 15px 18px; border-radius: 12px; font-size: 12px; box-shadow: 0 15px 40px rgba(25,26,23,.22); }
.floating-note span { color: var(--lime); margin-left: 12px; }
.statement { padding: 13vw 10vw; background: var(--ink); color: white; text-align: center; }
.statement .section-label { color: var(--lime); }
.statement h2 { max-width: 900px; margin: 25px auto; font-size: clamp(44px, 7vw, 92px); line-height: .97; letter-spacing: -.06em; }
.statement > p:last-child { max-width: 670px; margin: 35px auto 0; font-size: 18px; line-height: 1.7; color: rgba(255,255,255,.56); }
.features { padding: 10vw 7vw; }
.section-heading { display: flex; justify-content: space-between; align-items: end; gap: 30px; margin-bottom: 65px; }
.section-heading h2 { margin: 14px 0 0; font-size: clamp(40px, 5vw, 68px); letter-spacing: -.055em; line-height: 1; }
.section-heading > p { max-width: 390px; margin: 0; color: rgba(25,26,23,.6); line-height: 1.6; }
.feature-grid { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid var(--line); }
.feature-card { min-height: 310px; padding: 35px 35px 30px 0; border-right: 1px solid var(--line); }
.feature-card + .feature-card { padding-left: 35px; }
.feature-card:last-child { border: 0; }
.feature-number { display: inline-grid; place-items: center; width: 42px; height: 26px; border-radius: 999px; background: var(--lime); font-size: 10px; font-weight: 800; }
.feature-card h3 { margin: 85px 0 13px; font-size: 27px; letter-spacing: -.04em; }
.feature-card p { max-width: 330px; color: rgba(25,26,23,.58); line-height: 1.6; }
.cta { margin: 0 2vw 2vw; padding: 7vw; min-height: 500px; border-radius: 24px; background: var(--violet); color: white; display: flex; justify-content: space-between; align-items: end; gap: 30px; }
.cta .section-label { color: var(--lime); }
.cta h2 { margin: 20px 0 0; font-size: clamp(48px, 7vw, 92px); line-height: .94; letter-spacing: -.065em; }
.button-light { background: white; color: var(--ink); border-color: white; min-width: 190px; }
footer { min-height: 120px; padding: 0 5vw; display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: rgba(25,26,23,.55); }
.reveal { opacity: 0; transform: translateY(18px); transition: opacity .6s, transform .6s; }
.reveal.visible { opacity: 1; transform: none; }
@media (max-width: 900px) {
  .site-header { padding: 0 22px; }
  .site-header > .button { display: none; }
  .menu-button { display: block; margin-left: auto; }
  .site-nav { display: none; position: absolute; top: 82px; left: 0; right: 0; padding: 25px; background: var(--paper); border-bottom: 1px solid var(--line); flex-direction: column; }
  .site-nav.open { display: flex; }
  .hero { padding: 10vh 7vw 4vh; min-height: auto; }
  .hero-visual { position: relative; inset: auto; width: 100%; height: 430px; margin-top: 55px; }
  .feature-grid { grid-template-columns: 1fr; }
  .feature-card, .feature-card + .feature-card { padding: 35px 0; min-height: 230px; border-right: 0; border-bottom: 1px solid var(--line); }
  .feature-card h3 { margin-top: 45px; }
  .section-heading, .cta { align-items: flex-start; flex-direction: column; }
}
@media (max-width: 600px) {
  h1 { font-size: 58px; }
  .hero-actions { align-items: flex-start; flex-direction: column; }
  .hero-visual { height: 330px; }
  .statement, .features { padding: 90px 24px; }
  .cta { margin: 0 12px 12px; padding: 65px 28px; min-height: 470px; }
  footer { padding: 30px 24px; align-items: flex-start; flex-direction: column; gap: 24px; }
}
"""

        app_js = """const menuButton = document.querySelector('.menu-button');
const navigation = document.querySelector('.site-nav');

menuButton?.addEventListener('click', () => {
  const isOpen = navigation.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(isOpen));
});

document.querySelectorAll('.site-nav a').forEach((link) => {
  link.addEventListener('click', () => {
    navigation.classList.remove('open');
    menuButton?.setAttribute('aria-expanded', 'false');
  });
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.16 });

document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
document.querySelector('#year').textContent = new Date().getFullYear();

document.querySelector('#primary-action')?.addEventListener('click', (event) => {
  event.currentTarget.textContent = 'You’re on the list ✓';
  event.currentTarget.disabled = true;
});
"""

        readme = f"""# {title}

Generated by **Hoolulu Factory** from this request:

> {clean_prompt[:500]}

## Run locally

This project has no dependencies. Open `index.html` directly, or serve the folder:

```bash
python -m http.server 8080
```

Then open <http://localhost:8080>.

## Files

- `index.html` — accessible page structure
- `styles.css` — responsive visual system
- `app.js` — menu, reveal, and call-to-action interactions
- `factory-manifest.json` — build provenance and Frozen Core digest
"""
        return GeneratedProject(
            summary=f"Built a polished, responsive {project_kind} starter for {title}.",
            files={
                "index.html": index_html,
                "styles.css": styles,
                "app.js": app_js,
                "README.md": readme,
            },
            generator="hoolulu-local-v1",
        )

    @staticmethod
    def _title_from_prompt(prompt: str) -> str:
        compact = " ".join(prompt.split())
        for prefix in (
            "Please build me ",
            "Please build ",
            "Build me ",
            "Create me ",
            "Create a ",
            "Build a ",
            "Make a ",
            "Create ",
            "Build ",
        ):
            if compact.lower().startswith(prefix.lower()):
                compact = compact[len(prefix) :]
                break
        compact = re.split(r"[.!?]|\bwith\b|\bthat\b", compact, maxsplit=1, flags=re.IGNORECASE)[0]
        words = compact.strip(" ,:-").split()[:7]
        title = " ".join(words) or "A Better Digital Experience"
        return title[0].upper() + title[1:]

    @staticmethod
    def _features_for(project_kind: str) -> list[tuple[str, str]]:
        if project_kind == "storefront":
            return [
                ("Effortless discovery", "A clear path from first glance to the products people want most."),
                ("Confident choices", "Focused details and thoughtful hierarchy make every decision feel easy."),
                ("Ready to convert", "Responsive calls to action keep momentum alive on every device."),
            ]
        if project_kind == "dashboard":
            return [
                ("Signal over noise", "Important metrics surface first, with hierarchy that reduces cognitive load."),
                ("Fast orientation", "Consistent patterns help operators understand state at a glance."),
                ("Actionable detail", "Every insight leads naturally to a clear and useful next action."),
            ]
        if project_kind == "portfolio":
            return [
                ("Work that leads", "Projects get the space and pacing they need to make a strong impression."),
                ("A human story", "Intentional narrative gives the work context without getting in its way."),
                ("Clear connection", "Simple contact paths turn interest into a genuine conversation."),
            ]
        return [
            ("Clear by design", "Strong hierarchy gives every visitor an immediate sense of place and purpose."),
            ("Built for momentum", "Focused interactions guide people forward without unnecessary friction."),
            ("Distinctly yours", "A flexible visual language creates personality without compromising usability."),
        ]
