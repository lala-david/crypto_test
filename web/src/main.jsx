import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router-dom";
import "./styles/style.css";
import "./styles/react.css";
import { I18nProvider } from "./lib/i18n.jsx";
import { TooltipHost } from "./components/Tooltip.jsx";
import Layout from "./components/Layout.jsx";
import Overview from "./pages/Overview.jsx";
import Incidents from "./pages/Incidents.jsx";
import Stats from "./pages/Stats.jsx";
import Briefings from "./pages/Briefings.jsx";
import Addresses from "./pages/Addresses.jsx";
import IncidentDetail from "./pages/IncidentDetail.jsx";
import { detectMode } from "./lib/api.js";

// 정적 배포(파일 경로)에서도 링크가 깨지지 않게 HashRouter 를 쓴다.
detectMode().then(() => {
  createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <I18nProvider>
        <TooltipHost>
          <HashRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Overview />} />
                <Route path="incidents" element={<Incidents />} />
                <Route path="stats" element={<Stats />} />
                <Route path="briefings" element={<Briefings />} />
                <Route path="addresses" element={<Addresses />} />
                <Route path="incident/:uid" element={<IncidentDetail />} />
              </Route>
            </Routes>
          </HashRouter>
        </TooltipHost>
      </I18nProvider>
    </React.StrictMode>,
  );
});
