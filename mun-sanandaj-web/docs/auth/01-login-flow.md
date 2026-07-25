# How Login Works (mun-sanandaj-web)

> **Level:** Beginner
> **Topic:** Authentication
> **Files covered:** `src/auth/routes.tsx`, `src/auth/oidc.ts`, `src/auth/AuthProvider.tsx`, `src/auth/useAuth.ts`, `src/app/router.tsx`

This document explains, in simple words, how a user logs in to this app.

---

## 1. The Big Idea (in one sentence)

This app **does not have its own login form**. It sends the user to a **central login server** (called the "IdP" — Identity Provider). The IdP checks the password and sends the user back with a **token** (a signed proof of who they are). This standard flow is called **OIDC** (OpenID Connect).

Think of it like a **concert**:

- The app = the concert hall.
- The IdP = the ticket office outside.
- You (user) go to the ticket office, prove who you are, and get a **wristband (token)**.
- You come back to the concert hall and show the wristband. The hall never checks your ID itself — it trusts the wristband.

---

## 2. The Main Pieces (who does what)

| File | Job (simple words) |
|------|--------------------|
| `oidc.ts` | Sets up the connection to the login server (the "rules of the game"). |
| `AuthProvider.tsx` | Remembers **who is logged in** and shares it with the whole app. |
| `useAuth.ts` | A small hook so any component can ask: "Is someone logged in? Are they admin?" |
| `routes.tsx` | The **screens** and **guards** — the login page, the "coming back from login" page, and the locks on protected pages. |
| `router.tsx` | The **map** — which URL shows which screen. |

---

## 3. The Login Flow, Step by Step

Here is what happens when a new visitor arrives.

### Step 1 — Visitor opens the app

The visitor goes to `/`. But `/` is a **protected page**. In `router.tsx`, protected pages are wrapped in `<RequireAuth>`.

```tsx
// router.tsx
{
  element: <RequireAuth />,        // <-- lock #1: must be logged in
  children: [
    { element: <RequireAdmin />,   // <-- lock #2: must be admin
      children: [ /* Dashboard, Logs ... */ ]
    },
  ],
},
```

### Step 2 — `RequireAuth` checks the wristband

`RequireAuth` (in `routes.tsx`) asks `useAuth()`: "Do we know this user yet? Are they logged in?"

```tsx
export function RequireAuth() {
  const { ready, user } = useAuth();
  if (!ready) return <Spin fullscreen />;          // still checking → show spinner
  if (!user)  return <Navigate to="/login" replace />; // no user → go to login page
  return <Outlet />;                               // has user → show the page
}
```

- `ready` = "have we finished checking storage for an existing login?"
- `user` = the logged-in person, or `null`.

A brand-new visitor has **no user**, so they get redirected to `/login`.

### Step 3 — The Login screen

`/login` shows `LoginScreen`. It is just a card with one **"ورود" (Enter)** button. Pressing it calls `login`:

```tsx
const { login, user, ready } = useAuth();
// ...
<Button onClick={login}>ورود</Button>
```

If the user is **already** logged in, the screen skips itself:

```tsx
if (ready && user) return <Navigate to="/" replace />;
```

### Step 4 — `login()` sends the user to the IdP

`login` lives in `AuthProvider.tsx`:

```tsx
const login = useCallback(() => {
  void getUserManager().signinRedirect();
}, []);
```

`signinRedirect()` **leaves this app** and opens the login server in the same browser tab. The address of that server, the app's ID, and what we ask for (name, email, roles) all come from `oidc.ts`:

```ts
// oidc.ts
_userManager = new UserManager({
  authority:    import.meta.env.VITE_AUTH_AUTHORITY,      // the login server URL
  client_id:    "mun-sanandaj-web",                       // this app's name at the IdP
  redirect_uri: `${origin}/auth/callback`,                // where to come back to
  response_type: "code",                                  // the secure "Authorization Code" flow
  scope: "openid profile email roles mabhas19.api",       // what info we request
});
```

### Step 5 — User signs in on the IdP

On the login server the user types their username/password (or OTP, etc.). This all happens **outside our app**. We never see the password.

### Step 6 — The IdP sends the user back to `/auth/callback`

After a successful login, the IdP redirects the browser back to `redirect_uri` = `/auth/callback`. That URL shows `OidcCallback`:

```tsx
export function OidcCallback() {
  // ...
  useEffect(() => {
    if (ran.current) return;      // guard: only run once
    ran.current = true;
    getUserManager()
      .signinRedirectCallback()   // read the token from the URL and save it
      .then(() => navigate("/", { replace: true }))  // success → go home
      .catch(() => setError("ورود ناموفق بود"));      // fail → show error
  }, []);
  return <Spin tip="در حال ورود…" fullscreen />; // spinner while it works
}
```

`signinRedirectCallback()` reads the code the IdP put in the URL, exchanges it for the **token**, and saves the token in the browser's `localStorage`. Then it sends the user to `/`.

> **Why `ran.current`?** React can run effects twice in development. This flag makes sure we only process the callback **once**.

### Step 7 — `AuthProvider` notices the new user

`AuthProvider` listens for login events. When the token is saved, it fires `addUserLoaded`, and `AuthProvider` updates its `user` state:

```tsx
mgr.events.addUserLoaded(onLoaded);   // login happened → set the user
mgr.events.addUserUnloaded(onUnloaded); // logout happened → clear the user
```

Now `useAuth()` returns a real `user`. This time `RequireAuth` lets them in, and they see the Dashboard. **Login is complete.** ✅

---

## 4. What happens on the next visit? (staying logged in)

When the user comes back later, we do **not** want to send them to the login server again. So when `AuthProvider` first mounts, it checks storage for an existing, non-expired token:

```tsx
const u = await mgr.getUser();          // read saved token from localStorage
apply(u);                               // if valid, we're logged in
setReady(true);                         // done checking
```

While this check runs, `ready` is `false`, so `RequireAuth` shows a spinner instead of bouncing the user to `/login`. This is why `ready` exists — it prevents a "flash" of the login page for users who are actually logged in.

### Silent renew (invisible re-login)

Tokens expire after a while. `oidc.ts` turns on `automaticSilentRenew: true`. Before a token expires, the library quietly re-logs-in **in a hidden iframe** using `/auth/silent`:

```tsx
export function OidcSilentCallback() {
  useEffect(() => {
    getUserManager().signinSilentCallback().catch(() => { /* ignore */ });
  }, []);
  return null; // nothing to show — it runs invisibly
}
```

The user never notices; their session just keeps working.

---

## 5. Roles: who is an admin?

The token carries the user's **roles**. `oidc.ts` turns the raw token into a simple object:

```ts
export function sessionUserFromOidc(u: User): SessionUser {
  const roles = /* read "role" or "roles" from the token */;
  return {
    id, name, email,
    isAdmin: roles.includes("Administrator"),  // <-- admin check
  };
}
```

`RequireAdmin` uses this to lock admin-only pages:

```tsx
export function RequireAdmin() {
  const { ready, isAdmin } = useAuth();
  if (!ready) return <Spin fullscreen />;
  return isAdmin ? <Outlet /> : <Navigate to="/403" replace />; // not admin → 403
}
```

A logged-in but non-admin user gets sent to `/403` (the `ForbiddenScreen`).

---

## 6. Logout

Visiting `/logout` shows `LogoutScreen`, which calls `logout()` on mount:

```tsx
const logout = useCallback(() => {
  void getUserManager().signoutRedirect();  // tell the IdP to end the session too
}, []);
```

`signoutRedirect()` clears the local token **and** logs the user out of the central IdP, then returns them to `post_logout_redirect_uri` (the app's home).

---

## 7. The Whole Flow as a Diagram

> 🖥️ **Interactive version:** open **[login-flow-diagram.html](login-flow-diagram.html)** in your browser for a styled, color-coded diagram (light + dark theme). The ASCII version below is the same flow in text.

```
Visitor → "/" (protected)
   │
   ▼
RequireAuth: no user?  ──► redirect to /login
   │
   ▼
LoginScreen: click "ورود" → login() → signinRedirect()
   │
   ▼
════════ leaves the app ════════
        Central IdP (login server)
        user types password
════════ comes back ════════
   │
   ▼
/auth/callback → OidcCallback → signinRedirectCallback()
   │   (saves token in localStorage)
   ▼
AuthProvider fires "userLoaded" → sets user
   │
   ▼
RequireAuth: has user?  ──► RequireAdmin: isAdmin? ──► Dashboard ✅
                                    │
                                    └─ not admin ──► /403
```

---

## 8. Quick Glossary

| Term | Simple meaning |
|------|----------------|
| **OIDC** | The standard "log in with a central server" protocol used here. |
| **IdP** | Identity Provider — the central login server that checks passwords and issues tokens. |
| **Token** | A signed proof of who you are; the "wristband". |
| **`UserManager`** | The library object (from `oidc-client-ts`) that does all the OIDC work for us. |
| **Redirect** | The browser leaving one page/site and going to another. |
| **Callback** | The page the IdP sends you back to after login (`/auth/callback`). |
| **Guard** | A wrapper (`RequireAuth`, `RequireAdmin`) that blocks a page unless a condition is met. |
| **`ready`** | "Have we finished checking if the user is already logged in?" Prevents a flash of the login page. |
| **Silent renew** | Refreshing the token invisibly before it expires. |

---

## 9. Where to Look Next

- Add a new protected page → put its route **inside** `<RequireAuth>` in `router.tsx`.
- Add an admin-only page → put it **inside** `<RequireAdmin>`.
- Change what info we request from the IdP → edit `scope` in `oidc.ts`.
- Read the current user in any component → `const { user, isAdmin } = useAuth();`.
