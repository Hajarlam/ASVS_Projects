import { Component } from '@angular/core';

@Component({
  selector: 'app-about',
  standalone: true,
  template: `
    <div class="about">
      <div class="about-hero">
        <h1>About ASVS Security by Design</h1>
        <p class="about-lead">A modern tool to track, verify, and implement OWASP ASVS security requirements with AI-powered guidance.</p>
      </div>

      <div class="content">
        <section class="card">
          <h2>🔐 What is ASVS?</h2>
          <p>
            The OWASP Application Security Verification Standard (ASVS) is a framework of security
            requirements and controls that focus on defining the security requirements necessary
            when designing, developing and testing modern web applications and web services.
          </p>
        </section>

        <section class="card">
          <h2>📊 Security Levels</h2>
          <div class="levels">
            <div class="level level1">
              <span class="level-num">L1</span>
              <h3>Essential</h3>
              <p>Basic security requirements that all applications should meet. Suitable for low-risk applications.</p>
            </div>
            <div class="level level2">
              <span class="level-num">L2</span>
              <h3>Standard</h3>
              <p>Comprehensive security controls for applications handling sensitive data.</p>
            </div>
            <div class="level level3">
              <span class="level-num">L3</span>
              <h3>Advanced</h3>
              <p>Defense-in-depth security for critical applications and high-value assets.</p>
            </div>
          </div>
        </section>

        <section class="card">
          <h2>🛠️ How to Use This Tool</h2>
          <ul class="feature-list">
            <li>Browse security categories from the dashboard</li>
            <li>View detailed requirements for each category</li>
            <li>Mark requirements as completed to track progress</li>
            <li>Add notes to remember implementation details</li>
            <li>Use the Gemini AI assistant to get explanations and code examples</li>
            <li>Search for specific requirements by keyword or ID</li>
          </ul>
        </section>

        <section class="card">
          <h2>⚙️ Configuration</h2>
          <p>
            To use the Gemini AI feature, update your API key in
            <code>src/app/services/ai.service.ts</code>.
            Get your free API key at <a href="https://aistudio.google.com" target="_blank">Google AI Studio</a>.
          </p>
          <p class="version">Version 1.0.0 — ASVS 4.0 | Built with Angular 17</p>
        </section>
      </div>
    </div>
  `,
  styles: [`
    .about { max-width: 900px; margin: 0 auto; padding: 2rem; }
    .about-hero {
      text-align: center; padding: 3rem 0 2.5rem;
    }
    .about-hero h1 {
      font-size: clamp(1.8rem, 3vw, 2.5rem);
      font-weight: 700;
      background: linear-gradient(135deg, #e8edf5 30%, #00d4ff 70%, #7c3aed 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text; margin-bottom: 1rem;
    }
    .about-lead { color: #8a9bb5; font-size: 1.05rem; max-width: 600px; margin: 0 auto; line-height: 1.6; }
    .card {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px; padding: 2rem;
      margin-bottom: 1.5rem;
      transition: border-color 0.2s;
    }
    .card:hover { border-color: rgba(0,212,255,0.15); }
    .card h2 { font-size: 1.1rem; font-weight: 600; color: #e8edf5; margin-bottom: 1rem; }
    .card p { color: #8a9bb5; line-height: 1.7; font-size: 0.9rem; }
    .card p + p { margin-top: 0.75rem; }
    .levels { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
    .level {
      padding: 1.25rem; border-radius: 12px;
      display: flex; flex-direction: column; gap: 0.5rem;
    }
    .level1 { background: rgba(16,217,142,0.06); border: 1px solid rgba(16,217,142,0.2); }
    .level2 { background: rgba(0,212,255,0.06); border: 1px solid rgba(0,212,255,0.2); }
    .level3 { background: rgba(124,58,237,0.06); border: 1px solid rgba(124,58,237,0.2); }
    .level-num {
      font-family: 'JetBrains Mono', monospace; font-size: 0.75rem;
      font-weight: 700; letter-spacing: 1px;
    }
    .level1 .level-num { color: #10d98e; }
    .level2 .level-num { color: #00d4ff; }
    .level3 .level-num { color: #a78bfa; }
    .level h3 { font-size: 0.95rem; font-weight: 600; color: #e8edf5; margin: 0; }
    .level p { color: #8a9bb5; font-size: 0.82rem; line-height: 1.5; margin: 0; }
    .feature-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
    .feature-list li {
      color: #8a9bb5; font-size: 0.9rem; line-height: 1.5;
      padding-left: 1.5rem; position: relative;
    }
    .feature-list li::before { content: "→"; color: #00d4ff; position: absolute; left: 0; }
    code {
      background: rgba(0,212,255,0.1); color: #00d4ff;
      border-radius: 4px; padding: 2px 6px;
      font-family: 'JetBrains Mono', monospace; font-size: 0.85em;
    }
    a { color: #00d4ff; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .version { font-style: italic; color: #4a5a6a !important; margin-top: 1rem !important; }
    @media (max-width: 768px) {
      .levels { grid-template-columns: 1fr; }
    }
  `]
})
export class AboutComponent {}
