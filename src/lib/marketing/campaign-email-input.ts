import { z } from "zod";

export const campaignEmailBenefitSchema = z.object({
  title: z.string().max(120).optional(),
  body: z.string().min(1).max(400),
});

export const campaignEmailContentSchema = z.object({
  preheader: z.string().max(220).optional().default(""),
  eyebrow: z.string().max(160).optional().default(""),
  title: z.string().min(2).max(200),
  introduction: z.string().max(800).optional().default(""),
  paragraphs: z.array(z.string().max(4000)).max(20).optional().default([]),
  benefits: z.array(campaignEmailBenefitSchema).max(20).optional().default([]),
  callToActionLabel: z.string().max(80).optional(),
  callToActionUrl: z.string().max(500).optional(),
  senderName: z.string().max(80).optional(),
  senderRole: z.string().max(80).optional(),
  companyName: z.string().max(120).optional(),
  website: z.string().max(200).optional(),
  recipientCompany: z.string().max(160).optional(),
  campaignName: z.string().max(200).optional(),
  receivedWhy: z.string().max(400).optional(),
});

export const campaignHtmlBodySchema = z.string().min(8).max(200_000);
