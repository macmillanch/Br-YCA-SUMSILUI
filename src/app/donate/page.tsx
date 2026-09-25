import type { Metadata } from "next";
import { EmptyState, PageHeader, SectionUnavailable } from "@/components/site/EmptyState";
import { getBankDetails, getContactDetails } from "@/lib/content";
import { getPublicDonations } from "@/lib/donations";
import { shortDate } from "@/lib/dates";
import { formatPaise } from "@/lib/money";

export const metadata: Metadata = {
  title: "Donate",
  description:
    "How to contribute to Young Chakma Association, Sumsilui Branch. Contributions are received by bank transfer; this page does not process payments.",
};

export const revalidate = 300;

/** The list is a courtesy, not an archive — the published ledger holds every entry. */
const ACKNOWLEDGEMENTS_SHOWN = 24;

export default async function DonatePage() {
  const [contactRead, bankRead, acknowledgements] = await Promise.all([
    getContactDetails(),
    getBankDetails(),
    getPublicDonations(ACKNOWLEDGEMENTS_SHOWN),
  ]);
  const { contact, unavailable: contactUnavailable } = contactRead;
  const { bank, unavailable: bankUnavailable } = bankRead;

  return (
    <div className="container-page max-w-3xl space-y-8 py-10">
      <PageHeader
        eyebrow="Support the branch"
        title="Donate and contribute"
        description="The branch is carried by what members and well-wishers give. This page gives the details needed to pay in a contribution — it does not take payment itself."
      />

      <div className="rounded-[12px] border border-red-700/30 bg-red-100 p-5 text-sm leading-6 text-ink">
        <p className="font-semibold text-red-700">No payment is collected on this website.</p>
        <p className="mt-1">
          There is no card payment, no UPI checkout, and no link that takes money from a visitor. Money
          reaches the association only through the account details below, or by handing a contribution
          to an office-bearer. Receipts are issued by the Treasurer.
        </p>
      </div>

      <section aria-labelledby="bank-details">
        <h2 id="bank-details">Account for contributions</h2>
        {bankUnavailable ? (
          <div className="mt-4">
            <SectionUnavailable what="The account details" />
          </div>
        ) : (
          <>
            <dl className="mt-4 divide-y divide-line border-y border-line text-sm">
              {([
                { label: "Account name", value: bank.accountName },
                { label: "Bank", value: bank.bankName },
                { label: "Branch", value: bank.bankBranch },
                { label: "Account number", value: bank.accountNumber },
                { label: "IFSC", value: bank.ifsc },
                { label: "UPI ID", value: bank.upiId },
              ] as const).map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-4 py-3">
                  <dt className="text-ink-muted">{row.label}</dt>
                  <dd className="text-right font-medium">
                    {row.value ?? (
                      <span className="rounded-[4px] bg-paper-alt px-2 py-0.5 text-xs font-normal text-ink-muted">
                        to be published by the Treasurer
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs leading-5 text-ink-muted">
              Bank details are never invented on this site. The Treasurer enters the association&rsquo;s
              real account once in Admin&nbsp;&rarr;&nbsp;Settings, and this page then reads it from
              there — so a corrected account number appears here without a redeploy.
            </p>
          </>
        )}
      </section>

      <section aria-labelledby="acknowledgements">
        <h2 id="acknowledgements">Contributions acknowledged with thanks</h2>
        <p className="mt-3 text-[15px] leading-7 text-ink-muted">
          Where a donor has agreed that their name may appear publicly, contributions are listed here
          and every one of them also appears as an income entry in the published ledger, so the list of
          names and the accounts can be checked against each other.
        </p>

        {acknowledgements.state === "unavailable" ? (
          <div className="mt-4">
            <SectionUnavailable what="The list of contributions" many={false} />
          </div>
        ) : null}

        {acknowledgements.state === "empty" ? (
          <div className="mt-4">
            <EmptyState
              title="No names have been listed yet"
              body="A contribution appears here only once the donor has agreed that their name may be published. Until then the figure stands in the published ledger on its own, and receipts are issued by the Treasurer."
            />
          </div>
        ) : null}

        {acknowledgements.state === "ready" ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <caption className="sr-only">Contributions the branch is grateful for</caption>
              <thead>
                <tr className="border-b-2 border-green-900 text-left">
                  {(
                    [
                      { heading: "Donor", align: "left" },
                      { heading: "Given for", align: "left" },
                      { heading: "Day", align: "left" },
                      { heading: "Amount", align: "right" },
                    ] as const
                  ).map((column) => (
                    <th
                      key={column.heading}
                      scope="col"
                      className={`py-2 pr-4 font-semibold ${
                        column.align === "right" ? "text-right" : ""
                      }`}
                    >
                      {column.heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {acknowledgements.items.map((item) => (
                  <tr
                    key={`${item.date}-${item.donorName}-${item.purpose}`}
                    className="border-b border-line"
                  >
                    <th scope="row" className="py-2.5 pr-4 text-left font-medium">
                      {item.donorName}
                    </th>
                    <td className="py-2.5 pr-4">{item.purpose}</td>
                    <td className="py-2.5 pr-4 tabular-nums">{shortDate(item.date)}</td>
                    <td className="py-2.5 text-right tabular-nums text-green-900">
                      {formatPaise(item.amountPaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs leading-5 text-ink-muted">
              The most recent {ACKNOWLEDGEMENTS_SHOWN} acknowledged contributions. Every contribution
              the branch has received stands in the ledger for its year, whether or not a name is shown
              here.
            </p>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="other-ways">
        <h2 id="other-ways">Other ways to help</h2>
        <p className="mt-3 text-[15px] leading-7">
          A contribution need not be money. The branch can use help running a student class, a pair of
          hands at a camp, or a vehicle for a day. Write to the Secretary at{" "}
          {contact.email ? (
            <a href={`mailto:${contact.email}`} className="text-green-700 underline underline-offset-2">
              {contact.email}
            </a>
          ) : (
            <span className="text-ink-muted">
              {contactUnavailable
                ? "the branch office email, which cannot be read just now"
                : "the branch office email, once published"}
            </span>
          )}{" "}
          or call at the office during its hours.
        </p>
      </section>
    </div>
  );
}
