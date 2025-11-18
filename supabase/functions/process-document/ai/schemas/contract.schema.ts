import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

export const ContractSummarySchema = z.object({
  identificacion: z.object({
    numero_contrato: z.string().nullable(),
    fecha_firma: z.string().nullable(),
    vigencia_inicio: z.string().nullable(),
    vigencia_termino: z.string().nullable(),
    plazo_ejecucion_dias: z.number().nullable(),
  }),
  partes: z.object({
    mandante: z.object({
      nombre: z.string().nullable(),
      rut: z.string().nullable(),
      representante: z.string().nullable(),
    }),
    contratista: z.object({
      nombre: z.string().nullable(),
      rut: z.string().nullable(),
      representante: z.string().nullable(),
    }),
  }),
  objeto_contrato: z.object({
    descripcion: z.string().nullable(),
    referencias_licitacion: z.string().nullable(),
  }),
  precio_y_pago: z.object({
    monto_maximo_uf: z.number().nullable(),
    modalidad: z.string().nullable(),
    reajustable: z.boolean(),
  }),
  actividades_y_entregables: z.array(
    z.object({
      item: z.string(),
      descripcion: z.string(),
      unidad: z.string().nullable(),
      precio_uf: z.number().nullable(),
    })
  ),
  administracion: z.object({
    administrador_mandante: z.object({
      nombre: z.string().nullable(),
      correo: z.string().nullable(),
    }),
    administrador_contratista: z.object({
      nombre: z.string().nullable(),
      correo: z.string().nullable(),
    }),
  }),
  obligaciones_legales: z.object({
    leyes_mencionadas: z.array(z.string()),
    modelo_prevencion_delitos: z.boolean(),
    cumple_normas_sso: z.boolean(),
  }),
  termino_anticipado: z.object({
    permitido_sin_causa: z.boolean(),
    detalle: z.string().nullable(),
  }),
  firmas: z.object({
    firmado_por_mandante: z.string().nullable(),
    firmado_por_contratista: z.string().nullable(),
  }),
});

export type ContractSummary = z.infer<typeof ContractSummarySchema>;
