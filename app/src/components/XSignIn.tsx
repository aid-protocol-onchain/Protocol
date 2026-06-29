import { useXAuth } from "../wallet/xauth";

// "Sign in with X" (OAuth 2.0). The flow runs entirely on the Worker; this reflects
// the shared session and links to /api/auth/x/login.
export function XSignIn() {
  const { user, loading, signOut } = useXAuth();

  if (loading) return null; // avoid flicker

  if (user) {
    return (
      <div className="xchip" title={`Signed in as @${user.handle}`}>
        {user.avatar ? (
          <img src={user.avatar} alt="" className="xav" />
        ) : (
          <span className="xav xav-fallback">{user.handle.slice(0, 1).toUpperCase()}</span>
        )}
        <span className="xhandle">@{user.handle}</span>
        <button className="xlogout" onClick={signOut} aria-label="Sign out of X">
          <i className="ti ti-x" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <a className="btn-x" href="/api/auth/x/login" aria-label="Sign in with X">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
      <span className="x-label">Sign in with X</span>
    </a>
  );
}
