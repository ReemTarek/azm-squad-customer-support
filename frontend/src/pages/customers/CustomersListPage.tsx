import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listCustomers } from "../../lib/customersApi";

export function CustomersListPage() {
  const [search, setSearch] = useState("");
  const { data: customers, isLoading, error } = useQuery({
    queryKey: ["customers", search],
    queryFn: () => listCustomers(search || undefined),
  });

  return (
    <div className="page">
      <div className="page-header">
        <h1>Customers</h1>
        <Link to="/customers/new" className="button-link">New Customer</Link>
      </div>
      <input
        type="search"
        placeholder="Search by name or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="search-input"
      />
      {isLoading && <p>Loading…</p>}
      {error && <p role="alert" className="form-error">Failed to load customers.</p>}
      {customers && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Company</th>
              <th>Phone</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td><Link to={`/customers/${c.id}`}>{c.name}</Link></td>
                <td>{c.email}</td>
                <td>{c.company ?? "—"}</td>
                <td>{c.phone ?? "—"}</td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr><td colSpan={4}>No customers found.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
