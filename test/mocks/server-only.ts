// Test-only stand-in for the "server-only" package. Tests run under plain
// Node, not Next's "react-server" bundling condition, so the real package
// would throw on import; this no-op mirrors its server-side behavior.
export {};
