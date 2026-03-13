import { describe, expect, it } from "vitest";
import { validateToken, getTokenPreview, parseOAuthUrl } from "./oauth2";

describe("OAuth2 Helpers", () => {
  describe("validateToken", () => {
    it("valida tokens Discord válidos (novo formato)", () => {
      const validTokens = [
        // Tokens falsos, seguros para teste
        "MOCKTOKENLONGSTRINGFORTESTINGPURPOSES1234567890",
        "MOCK.TOKEN.FORMAT.FOR.TESTING.123456",
      ];
      validTokens.forEach((token) => {
        expect(validateToken(token)).toBe(true);
      });
    });

    it("rejeita tokens inválidos", () => {
      const invalidTokens = ["", "abc", "123", "token_invalido"];
      invalidTokens.forEach((token) => {
        expect(validateToken(token)).toBe(false);
      });
    });
  });

  describe("getTokenPreview", () => {
    it("retorna preview correto para tokens longos", () => {
      const token = "MOCKTOKENLONGSTRINGFORTESTINGPURPOSES1234567890";
      const preview = getTokenPreview(token);
      expect(preview).toBe("MOCKTOKENLONGST...");
      expect(preview.length).toBe(18);
    });

    it("retorna token completo se for curto", () => {
      const token = "short";
      const preview = getTokenPreview(token);
      expect(preview).toBe("short");
    });
  });

  describe("parseOAuthUrl", () => {
    it("extrai parâmetros corretamente", () => {
      const url = "https://discord.com/api/oauth2/authorize?client_id=123&response_type=code&redirect_uri=http://localhost&scope=identify";
      const params = parseOAuthUrl(url);
      expect(params.clientId).toBe("123");
      expect(params.redirectUri).toBe("http://localhost");
      expect(params.scope).toBe("identify");
    });

    it("lança erro para URL inválida", () => {
      expect(() => parseOAuthUrl("not a url")).toThrow();
    });
  });
});
