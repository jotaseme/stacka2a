import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { CATEGORY_DISPLAY, FRAMEWORK_DISPLAY, LANGUAGE_DISPLAY } from "@/lib/data";

export const metadata: Metadata = {
  title: "Submit Your A2A Agent",
  description:
    "Submit your A2A protocol agent to StackA2A. Get quality-scored, indexed, and discoverable.",
  alternates: { canonical: "https://stacka2a.dev/submit-agent" },
};

export default function SubmitAgentPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  return <SubmitAgentContent searchParams={searchParams} />;
}

async function SubmitAgentContent({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const params = await searchParams;
  const submitted = params.submitted === "true";

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Submit Agent" },
        ]}
      />

      <div className="flex flex-col gap-2 mb-10 animate-fade-up">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">
          Contribute
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
          Submit Your Agent
        </h1>
        <p className="text-text-secondary">
          Built an A2A-compatible agent? Submit it here and we&apos;ll review,
          score, and add it to the directory.
        </p>
      </div>

      {submitted ? (
        <div className="rounded-2xl border border-accent/30 bg-accent-soft p-8 text-center animate-fade-up">
          <div className="flex flex-col items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/20 text-accent">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            <h2 className="text-xl font-semibold text-text-primary">
              Submission received
            </h2>
            <p className="text-sm text-text-secondary max-w-md">
              We&apos;ll review your agent and get back to you at the email you
              provided. Most reviews are completed within 48 hours.
            </p>
          </div>
        </div>
      ) : (
        <form
          action="https://formspree.io/f/YOUR_FORM_ID"
          method="POST"
          className="flex flex-col gap-5 animate-fade-up stagger-1"
        >
          <input type="hidden" name="_next" value="https://stacka2a.dev/submit-agent?submitted=true" />

          <Field label="Agent name" required>
            <input
              type="text"
              name="agent_name"
              required
              placeholder="My A2A Agent"
              className="form-input"
            />
          </Field>

          <Field label="Repository URL" required>
            <input
              type="url"
              name="repository_url"
              required
              placeholder="https://github.com/org/repo"
              className="form-input"
            />
          </Field>

          <Field label="Agent Card URL">
            <input
              type="url"
              name="agent_card_url"
              placeholder="https://your-agent.com/.well-known/agent-card.json"
              className="form-input"
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Category" required>
              <select name="category" required className="form-input">
                <option value="">Select...</option>
                {Object.entries(CATEGORY_DISPLAY).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </Field>

            <Field label="Framework">
              <select name="framework" className="form-input">
                <option value="">Select...</option>
                {Object.entries(FRAMEWORK_DISPLAY).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </Field>

            <Field label="Language">
              <select name="language" className="form-input">
                <option value="">Select...</option>
                {Object.entries(LANGUAGE_DISPLAY).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Description" required>
            <textarea
              name="description"
              required
              rows={4}
              placeholder="What does your agent do? What skills does it expose?"
              className="form-input resize-none"
            />
          </Field>

          <Field label="Contact email" required>
            <input
              type="email"
              name="contact_email"
              required
              placeholder="you@example.com"
              className="form-input"
            />
          </Field>

          <button
            type="submit"
            className="mt-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-offset-2 focus:ring-offset-background"
          >
            Submit agent
          </button>
        </form>
      )}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-text-primary">
        {label}
        {required && <span className="text-accent ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}
