export const DEFAULT_USER_OPTIONS = Object.freeze({
  includeAttachments: true,
  disclosureAccepted: false,
});

export function sanitizeUserOptions(value = {}) {
  return {
    includeAttachments: value.includeAttachments !== false,
    disclosureAccepted: value.disclosureAccepted === true,
  };
}
