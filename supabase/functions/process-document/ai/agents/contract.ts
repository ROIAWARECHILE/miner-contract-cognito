import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { ContractSummarySchema } from "../schemas/contract.schema.ts";

export const CONTRACT_PROMPT = `
Eres un modelo experto en lectura y análisis de contratos técnicos y de ingeniería en Chile.

Tu tarea es extraer un resumen estructurado y validable del contrato entregado. Solo debes incluir información que esté presente en el texto, no asumas, no inventes. Si un campo no existe, indícalo como null.

Estructura la salida en formato JSON con los siguientes campos:

{
  "identificacion": {
    "numero_contrato": "",
    "fecha_firma": "",
    "vigencia_inicio": "",
    "vigencia_termino": "",
    "plazo_ejecucion_dias": null
  },
  "partes": {
    "mandante": {
      "nombre": "",
      "rut": "",
      "representante": ""
    },
    "contratista": {
      "nombre": "",
      "rut": "",
      "representante": ""
    }
  },
  "objeto_contrato": {
    "descripcion": "",
    "referencias_licitacion": ""
  },
  "precio_y_pago": {
    "monto_maximo_uf": null,
    "modalidad": "",
    "reajustable": false
  },
  "actividades_y_entregables": [
    {
      "item": "",
      "descripcion": "",
      "unidad": "",
      "precio_uf": null
    }
  ],
  "administracion": {
    "administrador_mandante": {
      "nombre": "",
      "correo": ""
    },
    "administrador_contratista": {
      "nombre": "",
      "correo": ""
    }
  },
  "obligaciones_legales": {
    "leyes_mencionadas": [],
    "modelo_prevencion_delitos": false,
    "cumple_normas_sso": false
  },
  "termino_anticipado": {
    "permitido_sin_causa": false,
    "detalle": ""
  },
  "firmas": {
    "firmado_por_mandante": "",
    "firmado_por_contratista": ""
  }
}

No agregues texto explicativo. Solo devuelve este JSON ya lleno con los valores encontrados.
`;

export const contractAgent = {
  type: "contract",
  model: "gpt-4o",
  prompt: CONTRACT_PROMPT,
  schema: ContractSummarySchema,
  validate: (output: unknown) => {
    const parsed = ContractSummarySchema.safeParse(output);
    return parsed.success ? parsed.data : null;
  }
};
