import type { Pass, PassApplicationFields, PassSigner, PassType } from "./passApi";

/**
 * NA FORM/00001/07 (Leave/Pass Application Proforma) as the create/edit
 * forms hold it: every field a string, "" for empty.
 */
export type PassFormValues = Record<Exclude<keyof PassApplicationFields, "pass_type">, string> & { pass_type: PassType | "" };

export const PASS_SIGNERS: { key: PassSigner; label: string }[] = [
  { key: "applicant", label: "Applicant's signature" },
  { key: "recommending_officer", label: "Recommending officer's signature" },
  { key: "approving_officer", label: "Approving officer's signature" },
];

export const emptyPassForm = (): PassFormValues => ({
  place_of_deployment: "",
  appointment: "",
  pass_type: "",
  request_through: "",
  request_to: "",
  reason: "",
  travel_destination: "",
  contact_address: "",
  contact_phone: "",
  recommending_officer_comment: "",
  recommending_officer_name: "",
  recommending_officer_appointment: "",
  recommending_officer_date: "",
  approving_officer_comment: "",
  approving_officer_name: "",
  approving_officer_appointment: "",
  approving_officer_date: "",
});

export const passFormFromPass = (pass: Pass): PassFormValues => {
  const empty = emptyPassForm();
  return Object.fromEntries(
    Object.keys(empty).map((key) => {
      const value = pass[key as keyof PassApplicationFields];
      return [key, value ? String(value).slice(0, key.endsWith("_date") ? 10 : undefined) : ""];
    }),
  ) as PassFormValues;
};

/** API body for the form fields: trimmed, "" sent as null. */
export const passFormPayload = (values: PassFormValues): PassApplicationFields =>
  Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, value.trim() === "" ? null : value.trim()]),
  ) as PassApplicationFields;

export const PASS_TYPE_LABEL: Record<string, string> = { normal: "Normal", weekend: "Weekend", annual: "Annual" };

const OFFICER_FIELDS = ["recommending_officer", "approving_officer"].flatMap((o) =>
  ["comment", "name", "appointment", "date"].map((f) => `${o}_${f}`),
);

/**
 * While the pass approval workflow signs items 14–15, the form leaves them
 * out entirely, so details typed before the workflow was switched on don't
 * get sent back (the server refuses them).
 */
export const withoutOfficerFields = <T extends object>(payload: T): T =>
  Object.fromEntries(Object.entries(payload).filter(([key]) => !OFFICER_FIELDS.includes(key))) as T;
