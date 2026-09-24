import { Button } from "@/components/ui/Button";
import type { ContactDetails } from "@/lib/content";

function Missing({ label }: { label: string }) {
  return (
    <p className="text-sm text-ink-muted">
      {label}
      <span className="ml-1 rounded-[4px] bg-paper-alt px-1.5 py-0.5 text-xs text-ink">
        not published yet
      </span>
    </p>
  );
}

export function ContactSection({ contact }: { contact: ContactDetails }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <address className="not-italic">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Address</p>
        <p className="mt-2 text-[15px] leading-7">
          {contact.addressLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </p>

        <dl className="mt-5 space-y-3 text-[15px]">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Phone</dt>
            <dd className="mt-1">
              {contact.phone ? (
                <a href={`tel:${contact.phone}`} className="text-green-700 underline underline-offset-2">
                  {contact.phone}
                </a>
              ) : (
                <Missing label="The branch office phone number is" />
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Email</dt>
            <dd className="mt-1">
              {contact.email ? (
                <a
                  href={`mailto:${contact.email}`}
                  className="text-green-700 underline underline-offset-2"
                >
                  {contact.email}
                </a>
              ) : (
                <Missing label="The branch office email address is" />
              )}
            </dd>
          </div>
          {contact.officeHours ? (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
                Office hours
              </dt>
              <dd className="mt-1">{contact.officeHours}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button href="/contact" variant="ghost">
            Contact details
          </Button>
          {contact.mapUrl ? (
            <Button href={contact.mapUrl} target="_blank" rel="noreferrer">
              Open in maps
            </Button>
          ) : null}
        </div>
      </address>

      <div className="rounded-[12px] border border-line bg-paper-alt p-6">
        <h3 className="text-lg">How to reach the branch</h3>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          Office-bearers keep regular hours at the branch office. Members and well-wishers are welcome
          to call, or to write to the Secretary about any matter the association handles.
        </p>
        <p className="mt-4 text-sm leading-6 text-ink-muted">
          For anything that concerns accounts &mdash; a receipt, an audit query, or a donation you would
          like acknowledged &mdash; write to the Treasurer through the same office address.
        </p>
      </div>
    </div>
  );
}
