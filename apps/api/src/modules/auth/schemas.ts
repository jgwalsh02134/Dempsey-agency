import { z } from "zod";

export const authUserResponse = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
});
