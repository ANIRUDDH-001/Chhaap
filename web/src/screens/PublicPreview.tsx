import { useState } from "react";
import { ArrowUpRight, ArrowRight, ShieldCheck, Check } from "lucide-react";

export function PublicPreview() {
  const [view, setView] = useState("desk");
  return (
    <main className="public-preview">
      <header className="preview-header">
        <a href="/" className="brand">
          <span className="registration-mark" aria-hidden>
            <i />
            <i />
            <i />
            <i />
          </span>
          chhaap.
        </a>
        <span className="preview-status">
          <span />
          Read-only visual preview
        </span>
        <a
          href="https://github.com/ANIRUDDH-001/Chhaap"
          className="text-button"
          target="_blank"
          rel="noreferrer"
        >
          View source <ArrowUpRight size={15} />
        </a>
      </header>
      <section className="preview-intro">
        <div>
          <p className="preview-eyebrow">THE MODERN PRINT COUNTER</p>
          <h1>
            Good printing starts
            <br />
            with a little <em>clarity.</em>
          </h1>
          <p className="preview-description">
            The conversation, the specifications, the quote, the next good print
            job. A considered workspace for the neighbourhood print shop.
          </p>
          <div className="button-row">
            <a className="button primary" href="http://localhost:5175/">
              Open the full local app <ArrowRight size={16} />
            </a>
            <a
              className="button"
              href="https://github.com/ANIRUDDH-001/Chhaap#start-locally-on-windows"
              target="_blank"
              rel="noreferrer"
            >
              Set up your own counter <ArrowUpRight size={15} />
            </a>
          </div>
          <p className="form-help">
            The full app needs Chhaap running on your computer. This public
            address currently has no connected shop backend.
          </p>
        </div>
        <aside className="preview-note">
          <span className="preview-note-mark">
            a little
            <br />
            less guesswork.
            <br />
            <em>
              a better
              <br />
              impression.
            </em>
          </span>
          <div>
            <span className="preview-swatch red" />
            <span className="preview-swatch blue" />
            <span className="preview-swatch yellow" />
          </div>
          <p>
            AI suggests.
            <br />
            You confirm.
            <br />
            Your rates decide.
          </p>
        </aside>
      </section>
      <section
        className="preview-gallery"
        aria-label="Views from the running fictional shop"
      >
        <div className="preview-gallery-bar">
          <div role="tablist" aria-label="Workspace preview">
            <button
              role="tab"
              aria-selected={view === "desk"}
              onClick={() => setView("desk")}
              className={view === "desk" ? "selected" : ""}
            >
              Quote desk
            </button>
            <button
              role="tab"
              aria-selected={view === "production"}
              onClick={() => setView("production")}
              className={view === "production" ? "selected" : ""}
            >
              Production
            </button>
          </div>
          <span>AMAN PRINTWORKS · FICTIONAL PILOT</span>
        </div>
        <div role="tabpanel">
          <img
            src={
              view === "desk"
                ? "/preview/workbench.jpg"
                : "/preview/production.jpg"
            }
            alt={
              view === "desk"
                ? "Actual quote desk of the fictional Aman Printworks shop"
                : "Actual production board of the fictional Aman Printworks shop"
            }
            width={1440}
            height={1000}
          />
        </div>
        <p className="preview-caption">
          Saved screenshots of the working local application. These images are
          for visual review; controls inside them are not interactive.
        </p>
      </section>
      <section className="preview-principles">
        <div>
          <Check size={18} />
          <h2>Every detail, reviewed.</h2>
          <p>
            Bring messages and screenshots together. Check the specifications
            before preparing a quotation.
          </p>
        </div>
        <div>
          <Check size={18} />
          <h2>Your rates, made clear.</h2>
          <p>
            Deterministic prices, frozen quotations and an owner’s review before
            an estimate becomes a commitment.
          </p>
        </div>
        <div>
          <ShieldCheck size={18} />
          <h2>Your counter. Your data.</h2>
          <p>
            No business data is submitted from this preview. The full local app
            keeps shop records and model inference on your machine.
          </p>
        </div>
      </section>
      <footer className="preview-footer">
        <span>made to make an impression.</span>
        <p>
          Fictional business, customer identities and sample rates. No real-user
          validation or business results are claimed.
        </p>
        <a
          href="https://github.com/ANIRUDDH-001/Chhaap/blob/main/README.md"
          className="text-button"
        >
          Explore the project <ArrowRight size={14} />
        </a>
      </footer>
    </main>
  );
}
