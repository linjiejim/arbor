// The public half of Arbor's update key. Installed copies only accept updates signed by its
// private half (repository secret ARBOR_UPDATE_KEY; a backup lives with the maintainer).
// Replacing this key means every installed copy has to be updated by hand once.
export const UPDATE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAk6Bps+0Dm9ybV/E+BG39B9/rAlpSTcpiRioHkGPZ72w=
-----END PUBLIC KEY-----
`

/** The latest release's manifest. This repository's "latest" release is always an Arbor release. */
export const UPDATE_URL = "https://github.com/linjiejim/arbor/releases/latest/download/arbor-update.json"
