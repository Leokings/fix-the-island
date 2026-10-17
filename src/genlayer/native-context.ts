// Publicly observed pinned per-site Bradbury contracts expose message.chain_id
// as 1 despite wallet chain 4221. Studionet contracts expose 61999; the adapter
// selects that verified value from its configured network, never from a ticket.
export const PER_SITE_NATIVE_CHAIN_ID = 1 as const;
