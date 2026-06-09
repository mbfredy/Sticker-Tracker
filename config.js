/*
 * App configuration.
 *
 * editHash = SHA-256 hash of the password that unlocks EDITING (tapping
 * stickers, +/- spares, reset, restore). Visitors without it stay in
 * read-only mode: they can browse the album and use Compare, but cannot
 * change anything. We store only the hash here, never the plain password.
 *
 * Note: this gate stops casual editing on the shared link, but a static
 * public site can't be made truly tamper-proof. Each visitor only edits
 * their own device copy, so the owner's collection is never affected.
 */
window.APP_CONFIG = {
  editHash: "8266498d969081c29737b8daeb5b51d60e56d008fff243a39d16c3032d42f6cf" // set to the SHA-256 of your chosen password
};
