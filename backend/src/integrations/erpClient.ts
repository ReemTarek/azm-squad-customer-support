export interface ErpClient {
  syncCustomer(customer: { id: string; email: string; name: string }): Promise<void>;
}

/**
 * Mock adapter demonstrating the ERP integration boundary. A real
 * implementation would call the actual ERP's customer-sync API here,
 * using the same ErpClient interface — no caller changes needed.
 */
export class NoopErpClient implements ErpClient {
  async syncCustomer(customer: { id: string; email: string; name: string }): Promise<void> {
    console.log(`[erp:mock] would sync customer ${customer.email} (${customer.id}) to external ERP`);
  }
}

export const erpClient: ErpClient = new NoopErpClient();
