import { lazy, Suspense, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  LayoutGrid,
  Inbox,
  FileText,
  BriefcaseBusiness,
  UsersRound,
  Calculator,
  ChartNoAxesColumn,
  Settings2,
  Moon,
  Sun,
  Search,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { api, ApiError, post } from "./lib/api";
import type { SessionInfo, RequestRecord } from "./lib/types";
import { SessionContext } from "./lib/session";
import { initials } from "./lib/format";
import { Loading, ErrorNote, Modal } from "./components/ui";
import { NewRequestForm } from "./components/NewRequestForm";
const PublicPreview = lazy(() =>
  import("./screens/PublicPreview").then((m) => ({ default: m.PublicPreview })),
);
const Workbench = lazy(() =>
  import("./screens/Workbench").then((m) => ({ default: m.Workbench })),
);
const Today = lazy(() =>
  import("./screens/Today").then((m) => ({ default: m.Today })),
);
const RequestList = lazy(() =>
  import("./screens/Today").then((m) => ({ default: m.RequestList })),
);
const Quotes = lazy(() =>
  import("./screens/Quotes").then((m) => ({ default: m.Quotes })),
);
const Jobs = lazy(() =>
  import("./screens/Jobs").then((m) => ({ default: m.Jobs })),
);
const Customers = lazy(() =>
  import("./screens/Customers").then((m) => ({ default: m.Customers })),
);
const Rates = lazy(() =>
  import("./screens/Management").then((m) => ({ default: m.Rates })),
);
const Reports = lazy(() =>
  import("./screens/Management").then((m) => ({ default: m.Reports })),
);
const Settings = lazy(() =>
  import("./screens/Management").then((m) => ({ default: m.Settings })),
);

const nav = [
  { path: "/today", name: "Today", icon: LayoutGrid },
  { path: "/requests", name: "Requests", icon: Inbox },
  { path: "/quotes", name: "Quotes", icon: FileText },
  { path: "/jobs", name: "Jobs", icon: BriefcaseBusiness },
  { path: "/customers", name: "Customers", icon: UsersRound },
  { path: "/rates", name: "Rate card", icon: Calculator },
  { path: "/reports", name: "Reports", icon: ChartNoAxesColumn },
  { path: "/settings", name: "Settings", icon: Settings2 },
];

async function openSession() {
  try {
    return await api<SessionInfo>("/session");
  } catch (e) {
    if (e instanceof ApiError && e.status === 401)
      return post<SessionInfo>("/session/demo");
    throw e;
  }
}
function Start() {
  const { data } = useQuery({
    queryKey: ["requests"],
    queryFn: () => api<{ items: RequestRecord[] }>("/requests"),
  });
  return data ? (
    <Navigate
      replace
      to={data.items.length ? "/requests/" + data.items[0].id : "/today"}
    />
  ) : (
    <Loading />
  );
}

export function App() {
  const location = useLocation();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: openSession,
    enabled: location.pathname !== "/preview",
    retry: false,
  });
  const navigate = useNavigate();
  const query = useQueryClient();
  const [newOpen, setNewOpen] = useState(false);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("chhaap-theme") || "light",
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("chhaap-theme", theme);
  }, [theme]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        navigate("/customers");
      }
    };
    addEventListener("keydown", handler);
    return () => removeEventListener("keydown", handler);
  }, [navigate]);
  if (location.pathname === "/preview")
    return (
      <Suspense fallback={<Loading />}>
        <PublicPreview />
      </Suspense>
    );
  if (session.isPending) return <Loading />;
  if (
    session.isError &&
    session.error instanceof ApiError &&
    session.error.status === 404
  )
    return (
      <Suspense fallback={<Loading />}>
        <PublicPreview />
      </Suspense>
    );
  if (session.isError)
    return (
      <div className="startup-error">
        <div className="brand">chhaap.</div>
        <ErrorNote
          message={session.error.message}
          retry={() => session.refetch()}
        />
        <p>
          Check that the Chhaap API is running. Your saved shop stays in the
          database.
        </p>
      </div>
    );
  const info = session.data;
  const active =
    nav.find((n) => location.pathname.startsWith(n.path)) || nav[1];
  return (
    <SessionContext.Provider value={info}>
      <div className="app-shell">
        <a className="skip-link" href="#main">
          Skip to workspace
        </a>
        <aside className="sidebar">
          <NavLink to="/" className="brand" aria-label="Chhaap home">
            <span className="registration-mark" aria-hidden>
              <i />
              <i />
              <i />
              <i />
            </span>
            chhaap.
          </NavLink>
          <div className="shop-identity">
            <div className="shop-monogram">{initials(info.shop.name)}</div>
            <div>
              <strong>{info.shop.name}</strong>
              <small>Your neighbourhood print counter</small>
            </div>
          </div>
          <nav className="primary-nav" aria-label="Main navigation">
            {nav.map((item, i) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  "nav-item " +
                  (isActive ? "active " : "") +
                  (i === 6 ? "nav-separated" : "")
                }
              >
                <item.icon size={19} />
                <span>{item.name}</span>
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="privacy-note">
              <ShieldCheck size={16} />
              <div>
                <strong>Your counter. Your data.</strong>
                <p>
                  Local AI. Transparent prices.
                  <br />
                  You approve what goes out.
                </p>
              </div>
            </div>
            <div className="owner">
              <span className="avatar">{initials(info.user.name)}</span>
              <div>
                <strong>{info.user.name}</strong>
                <small>Shop owner</small>
              </div>
              <button
                className="icon-button"
                aria-label={
                  "Switch to " +
                  (theme === "light" ? "dark" : "light") +
                  " theme"
                }
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              >
                {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
              </button>
            </div>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumbs">
              <span>{info.shop.name}</span>
              <span>/</span>
              <strong>{active.name}</strong>
            </div>
            <select
              className="mobile-page-picker"
              aria-label="Go to page"
              value={active.path}
              onChange={(e) => navigate(e.target.value)}
            >
              {nav.map((n) => (
                <option value={n.path} key={n.path}>
                  {n.name}
                </option>
              ))}
            </select>
            <div className="topbar-actions">
              <span
                className={
                  "mode-label " +
                  (info.shop.mode === "sample" ? "sample" : "private")
                }
              >
                {info.shop.mode === "sample"
                  ? "Fictional sample shop"
                  : "Private workspace"}
              </span>
              <button
                className="search-button"
                aria-label="Search customers"
                onClick={() => navigate("/customers")}
              >
                <Search size={17} />
                <span>Find a customer</span>
                <kbd>Ctrl K</kbd>
              </button>
              <button
                className="mobile-theme icon-button"
                aria-label="Toggle theme"
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              >
                <Moon size={17} />
              </button>
            </div>
          </header>
          <main className="page-content" id="main">
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/" element={<Start />} />
                <Route
                  path="/today"
                  element={<Today onNew={() => setNewOpen(true)} />}
                />
                <Route
                  path="/requests"
                  element={<RequestList onNew={() => setNewOpen(true)} />}
                />
                <Route
                  path="/requests/:id"
                  element={
                    <Workbench
                      key={location.pathname}
                      onNew={() => setNewOpen(true)}
                    />
                  }
                />
                <Route path="/quotes" element={<Quotes />} />
                <Route path="/jobs" element={<Jobs />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/rates" element={<Rates />} />
                <Route path="/reports" element={<Reports />} />
                <Route
                  path="/settings"
                  element={<Settings theme={theme} setTheme={setTheme} />}
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </main>
          <footer className="app-footer">
            <span>
              <span className="footer-dot" />
              The modern print counter
            </span>
            <span>
              {info.shop.mode === "sample"
                ? "Fictional business and sample rates."
                : "Private business records."}{" "}
              Messages and payments stay under your control.
            </span>
            <a
              href="https://github.com/ANIRUDDH-001/Chhaap"
              target="_blank"
              rel="noreferrer"
            >
              Open source <ArrowRight size={12} />
            </a>
          </footer>
        </div>
      </div>
      <Modal
        open={newOpen}
        onOpenChange={setNewOpen}
        title="Start with the conversation."
        description="Bring the request here. We’ll help make the details clear."
      >
        <NewRequestForm
          onCreate={async (values) => {
            const request = await post<RequestRecord>("/requests", {
              ...values,
              title: values.title || values.customer_name + "’s print request",
            });
            setNewOpen(false);
            query.invalidateQueries({ queryKey: ["requests"] });
            navigate("/requests/" + request.id);
          }}
        />
      </Modal>
    </SessionContext.Provider>
  );
}
