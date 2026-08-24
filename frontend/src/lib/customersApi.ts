import { apiClient } from "./apiClient";

export interface Customer {
  id: string;
  email: string;
  name: string;
  locale: "en" | "ar";
  createdAt: string;
  phone: string | null;
  company: string | null;
}

export async function listCustomers(search?: string) {
  const { data } = await apiClient.get<{ customers: Customer[] }>("/customers", {
    params: search ? { search } : undefined,
  });
  return data.customers;
}

export async function getCustomer(id: string) {
  const { data } = await apiClient.get<{ customer: Customer }>(`/customers/${id}`);
  return data.customer;
}

export interface CreateCustomerInput {
  email: string;
  password: string;
  name: string;
  phone?: string;
  company?: string;
}

export async function createCustomer(input: CreateCustomerInput) {
  const { data } = await apiClient.post<{ customer: Customer }>("/customers", input);
  return data.customer;
}

export interface UpdateCustomerInput {
  name?: string;
  phone?: string;
  company?: string;
}

export async function updateCustomer(id: string, input: UpdateCustomerInput) {
  const { data } = await apiClient.patch<{ customer: Customer }>(`/customers/${id}`, input);
  return data.customer;
}
