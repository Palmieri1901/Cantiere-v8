import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { YearProvider } from "@/lib/year";
import { AuthProvider } from "@/lib/auth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import Clienti from "@/pages/Clienti";
import Tariffe from "@/pages/Tariffe";
import PostiBarca from "@/pages/PostiBarca";
import Impostazioni from "@/pages/Impostazioni";
import Report from "@/pages/Report";
import Contratti from "@/pages/Contratti";
import Magazzino from "@/pages/Magazzino";
import Tubolari from "@/pages/Tubolari";
import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <YearProvider>
          <BrowserRouter>
            <Routes>
              {/* Rotte pubbliche */}
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Rotte protette */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Home />
                  </ProtectedRoute>
                }
              />
              <Route
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/clienti" element={<Clienti />} />
                <Route path="/posti-barca" element={<PostiBarca />} />
                <Route path="/tariffe" element={<Tariffe />} />
                <Route path="/impostazioni" element={<Impostazioni />} />
                <Route path="/report" element={<Report />} />
                <Route path="/contratti" element={<Contratti />} />
                <Route path="/magazzino" element={<Magazzino />} />
                <Route path="/tubolari" element={<Tubolari />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </YearProvider>
      </AuthProvider>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
