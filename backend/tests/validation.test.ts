// backend/tests/validation.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { createUser, tokenFor } from "./helpers/fixtures";

describe("validation error shape", () => {
  it("returns 400 with field-level details for a missing required field", async () => {
    const customer = await createUser({ email: "valcust@test.com", role: "Customer" });
    const token = tokenFor(customer);

    const res = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ priority: "Low" }); // missing required "subject"

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "subject" })])
    );
  });
});
