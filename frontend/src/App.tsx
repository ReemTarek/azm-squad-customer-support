import { BrowserRouter, Route, Routes } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardShellPage } from "./pages/DashboardShellPage";
import { CustomersListPage } from "./pages/customers/CustomersListPage";
import { CustomerFormPage } from "./pages/customers/CustomerFormPage";
import { CustomerDetailPage } from "./pages/customers/CustomerDetailPage";
import { RequireAuth } from "./auth/RequireAuth";
import { Layout } from "./components/Layout";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<DashboardShellPage />} />
          <Route
            path="/customers"
            element={
              <RequireAuth roles={["Admin", "Manager", "Agent"]}>
                <CustomersListPage />
              </RequireAuth>
            }
          />
          <Route
            path="/customers/new"
            element={
              <RequireAuth roles={["Admin", "Agent"]}>
                <CustomerFormPage />
              </RequireAuth>
            }
          />
          <Route
            path="/customers/:id"
            element={
              <RequireAuth roles={["Admin", "Manager", "Agent", "Customer"]}>
                <CustomerDetailPage />
              </RequireAuth>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
