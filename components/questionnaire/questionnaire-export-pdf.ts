import type {
  CustomBlock,
  EnrichedTemplateMapping,
  SubtemplateProperty,
} from "@/types/template";
import type { InputType } from "@/types/template";
import type {
  FieldOverrides,
  FormValue,
  OrderedBlock,
} from "./questionnaire-form-types";

import { PDFDocument, PDFName, PDFString, StandardFonts, rgb } from "pdf-lib";

import { CUSTOM_PREFIX } from "./questionnaire-form-constants";

import { getOrkgPropertyLink, getOrkgClassLink } from "@/lib/orkg-links";

export interface ExportQuestionnairePdfParams {
  templateId: string;
  label: string;
  mapping: EnrichedTemplateMapping;
  values: Record<string, FormValue>;
  orderedBlocks: OrderedBlock[];
  customBlocks: Record<string, CustomBlock>;
  fieldOverrides: FieldOverrides;
  /** Paths hidden in the form editor (e.g. `P31.P110`); omitted from the PDF. */
  removedBuiltinProperties?: string[];
  nestedCustomBlocks?: Record<string, string[]>;
  getEffectiveProperty(
    path: string,
    prop: SubtemplateProperty,
  ): SubtemplateProperty;
  getInputTypeForPath(path: string, prop: SubtemplateProperty): InputType;
}

export async function exportQuestionnaireToPdf(
  params: ExportQuestionnairePdfParams,
): Promise<void> {
  const {
    templateId,
    label,
    mapping,
    values,
    orderedBlocks,
    customBlocks,
    fieldOverrides,
    removedBuiltinProperties = [],
    nestedCustomBlocks = {},
    getEffectiveProperty,
    getInputTypeForPath,
  } = params;

  try {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    const W = 595,
      H = 842,
      M = 44;
    const CW = W - 2 * M; // content width
    const BM = 48; // bottom margin for footer

    // Theme colors
    const primary = rgb(232 / 255, 97 / 255, 97 / 255); // #e86161
    const primaryBg = rgb(254 / 255, 242 / 255, 242 / 255); // #fef2f2
    const accent = rgb(252 / 255, 165 / 255, 165 / 255); // #fca5a5
    const dark = rgb(0.13, 0.13, 0.13);
    const muted = rgb(0.55, 0.55, 0.55);
    const subtle = rgb(0.72, 0.72, 0.72);
    const divider = rgb(0.87, 0.87, 0.87);
    const fieldBdr = rgb(0.78, 0.78, 0.78);
    const fieldFill = rgb(0.97, 0.97, 0.97);
    const linkBlue = rgb(30 / 255, 136 / 255, 229 / 255); // #1e88e5 secondary

    const pages: (typeof page)[] = [];
    let page = pdfDoc.addPage([W, H]);

    pages.push(page);
    let y = M; // y = distance from top of page

    const py = (topY: number) => H - topY; // convert to PDF coords

    const newPage = () => {
      page = pdfDoc.addPage([W, H]);
      pages.push(page);
      y = M;
    };

    const need = (h: number) => {
      if (y + h > H - BM) newPage();
    };

    // ── Text helpers ───────────────────────────────────────────
    const wrap = (
      text: string,
      maxW: number,
      f: typeof font,
      sz: number,
    ): string[] => {
      if (!text) return [];
      const words = text.split(/\s+/);
      const lines: string[] = [];
      let cur = "";

      for (const w of words) {
        const t = cur ? `${cur} ${w}` : w;

        if (f.widthOfTextAtSize(t, sz) <= maxW) {
          cur = t;
        } else {
          if (cur) lines.push(cur);
          cur = w;
        }
      }
      if (cur) lines.push(cur);

      return lines;
    };

    // Draw text and return the width
    const drawText = (
      text: string,
      x: number,
      sz: number,
      f: typeof font,
      color: typeof dark,
    ) => {
      page.drawText(text, { x, y: py(y), size: sz, font: f, color });

      return f.widthOfTextAtSize(text, sz);
    };

    // Collect links to add at the very end (after form fields) to avoid
    // corrupting the form widget annotations that addToPage creates.
    const pendingLinks: {
      pageRef: typeof page;
      x: number;
      yTop: number;
      w: number;
      h: number;
      url: string;
    }[] = [];

    // Draw property ID as an ORKG link (blue underlined text)
    const drawPropertyLink = (propId: string, x: number, classId?: string) => {
      const url =
        getOrkgPropertyLink(propId) ??
        (classId ? getOrkgClassLink(classId) : null);
      const sz = 7.5;
      const tw = font.widthOfTextAtSize(propId, sz);

      page.drawText(propId, {
        x,
        y: py(y),
        size: sz,
        font,
        color: url ? linkBlue : muted,
      });
      if (url) {
        page.drawLine({
          start: { x, y: py(y) - 1 },
          end: { x: x + tw, y: py(y) - 1 },
          thickness: 0.5,
          color: linkBlue,
        });
        pendingLinks.push({
          pageRef: page,
          x,
          yTop: y,
          w: tw,
          h: sz + 2,
          url,
        });
      }

      return tw;
    };

    const form = pdfDoc.getForm();
    let fc = 0;

    const getType = (path: string, prop: SubtemplateProperty): InputType =>
      getInputTypeForPath(path, prop);

    const getValueForPath = (
      path: string,
      prop: SubtemplateProperty,
    ): FormValue | undefined => {
      const segments = path.split(".");

      if (!segments.length) return undefined;

      const rootId = segments[0]!;
      let current = values[rootId];

      if (current === undefined) return undefined;

      if (segments.length === 1) {
        if (
          typeof current === "object" &&
          current !== null &&
          !Array.isArray(current) &&
          prop.subtemplate_properties &&
          Object.keys(prop.subtemplate_properties).length > 0
        ) {
          const obj = current as Record<string, FormValue>;

          return obj._ ?? "";
        }

        return current;
      }

      if (
        typeof current !== "object" ||
        current === null ||
        Array.isArray(current)
      ) {
        return undefined;
      }

      let obj: unknown = current;

      for (let i = 1; i < segments.length; i++) {
        const key = segments[i]!;

        if (
          typeof obj !== "object" ||
          obj === null ||
          Array.isArray(obj) ||
          !(key in (obj as Record<string, unknown>))
        ) {
          return undefined;
        }

        obj = (obj as Record<string, unknown>)[key];
      }

      if (
        typeof obj === "object" &&
        obj !== null &&
        !Array.isArray(obj) &&
        prop.subtemplate_properties &&
        Object.keys(prop.subtemplate_properties).length > 0
      ) {
        const nested = obj as Record<string, FormValue>;

        return nested._ ?? "";
      }

      return obj as FormValue;
    };

    const toDisplayString = (v: FormValue | undefined): string => {
      if (v === undefined || v === null) return "";
      if (typeof v === "boolean") return v ? "true" : "false";
      if (Array.isArray(v)) return v.join(", ");

      return String(v);
    };

    const toBool = (v: FormValue | undefined): boolean => {
      if (typeof v === "boolean") return v;
      if (typeof v === "number") return v !== 0;
      if (typeof v === "string") {
        const s = v.trim().toLowerCase();

        return s === "true" || s === "yes" || s === "1";
      }

      return false;
    };

    const fetchOptions = async (
      pid: string,
      cid?: string,
    ): Promise<{ value: string; label: string }[]> => {
      try {
        const hasP = pid.match(/^P\d+$/);
        const hasC = cid?.match(/^C\d+$/);

        if (!hasP && !hasC) return [];
        const params = new URLSearchParams();

        if (hasP) params.set("predicateId", pid);
        if (cid) params.set("classId", cid);
        params.set("limit", "500");
        const res = await fetch(`/api/orkg/resources?${params.toString()}`);
        const data = await res.json();

        return (data.resources ?? []).map(
          (r: { id: string; label: string }) => {
            const rawLabel = r.label || r.id.split("/").pop() || r.id;

            return {
              value: r.id,
              label: rawLabel.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?"),
            };
          },
        );
      } catch {
        return [];
      }
    };

    // ── Draw a form field ──────────────────────────────────────
    const getOptionsForField = async (
      path: string,
      type: InputType,
      pid: string,
      prop: SubtemplateProperty,
    ): Promise<{ value: string; label: string }[]> => {
      if (type === "resource") {
        return fetchOptions(pid, prop.class_id);
      }
      if (type === "select") {
        const o = fieldOverrides[path];

        if (o?.selectOptions && o.selectOptions.length > 0) {
          return o.selectOptions.map((opt) => ({
            value: opt.value,
            label: (opt.label || opt.value).replace(
              /[^\x20-\x7E\xA0-\xFF]/g,
              "?",
            ),
          }));
        }

        return [
          { value: "option1", label: "Option 1" },
          { value: "option2", label: "Option 2" },
          { value: "option3", label: "Option 3" },
          { value: "other", label: "Other" },
        ];
      }
      if (type === "scale") {
        const sc = fieldOverrides[path]?.scaleConfig ?? { min: 1, max: 5 };
        const { min, max, minLabel, maxLabel } = sc;
        const labels: { value: string; label: string }[] = [];

        for (let i = min; i <= max; i++) {
          if (i === min && minLabel) {
            labels.push({ value: String(i), label: minLabel });
          } else if (i === max && maxLabel) {
            labels.push({ value: String(i), label: maxLabel });
          } else {
            labels.push({ value: String(i), label: String(i) });
          }
        }

        return labels;
      }

      return [];
    };

    const drawField = async (
      type: InputType,
      x: number,
      w: number,
      pid: string,
      prop: SubtemplateProperty,
      path: string,
      fieldValue?: FormValue,
    ) => {
      const name = `f_${fc++}`;

      if (type === "checkbox") {
        need(18);
        const cb = form.createCheckBox(name);

        cb.addToPage(page, {
          x,
          y: py(y + 14),
          width: 14,
          height: 14,
          borderColor: fieldBdr,
          borderWidth: 1,
        });
        if (toBool(fieldValue)) {
          cb.check();
        }
        y += 20;
      } else if (type === "resource" || type === "select" || type === "scale") {
        need(26);
        const opts = await getOptionsForField(path, type, pid, prop);

        if (opts.length > 0) {
          const dd = form.createDropdown(name);

          dd.addOptions(opts.map((o) => o.label));
          dd.addToPage(page, {
            x,
            y: py(y + 22),
            width: w,
            height: 22,
            borderColor: fieldBdr,
            borderWidth: 1,
            backgroundColor: fieldFill,
          });
          const valueStr =
            Array.isArray(fieldValue) && fieldValue.length > 0
              ? String(fieldValue[0])
              : typeof fieldValue === "string" || typeof fieldValue === "number"
                ? String(fieldValue)
                : undefined;

          if (valueStr) {
            const match = opts.find((opt) => opt.value === valueStr);

            if (match) {
              dd.select(match.label);
            }
          }
        } else {
          const tf = form.createTextField(name);

          tf.addToPage(page, {
            x,
            y: py(y + 22),
            width: w,
            height: 22,
            borderColor: fieldBdr,
            borderWidth: 1,
            backgroundColor: fieldFill,
          });
          const display = toDisplayString(fieldValue);

          if (display) {
            tf.setText(display);
          }
        }
        y += 28;
      } else {
        const h = type === "textarea" ? 44 : 22;

        need(h + 4);
        const tf = form.createTextField(name);

        if (type === "textarea") tf.enableMultiline();
        tf.addToPage(page, {
          x,
          y: py(y + h),
          width: w,
          height: h,
          borderColor: fieldBdr,
          borderWidth: 1,
          backgroundColor: fieldFill,
        });
        const display = toDisplayString(fieldValue);

        if (display) {
          tf.setText(display);
        }
        y += h + 6;
      }
    };

    // ══════════════════════════════════════════════════════════════
    //  HEADER
    // ══════════════════════════════════════════════════════════════
    // Title
    const titleLines = wrap(label, CW - 8, fontBold, 16);

    for (const ln of titleLines) {
      need(20);
      drawText(ln, M, 16, fontBold, primary);
      y += 20;
    }
    y += 2;

    // Template link
    const tidUrl = `https://orkg.org/templates/${templateId}`;
    const tidLabel = `Template: ${templateId}`;
    const tidW = font.widthOfTextAtSize(tidLabel, 8.5);

    drawText(tidLabel, M, 8.5, font, linkBlue);
    page.drawLine({
      start: { x: M, y: py(y) - 1 },
      end: { x: M + tidW, y: py(y) - 1 },
      thickness: 0.4,
      color: linkBlue,
    });
    pendingLinks.push({
      pageRef: page,
      x: M,
      yTop: y,
      w: tidW,
      h: 10,
      url: tidUrl,
    });
    y += 13;

    drawText(`Exported: ${new Date().toLocaleString()}`, M, 8, font, muted);
    y += 14;

    // Divider
    page.drawLine({
      start: { x: M, y: py(y) },
      end: { x: M + CW, y: py(y) },
      thickness: 0.75,
      color: divider,
    });
    y += 12;

    // ══════════════════════════════════════════════════════════════
    //  PROPERTIES
    // ══════════════════════════════════════════════════════════════
    const renderProperty = async (
      path: string,
      prop: SubtemplateProperty,
      depth: number,
    ) => {
      if (removedBuiltinProperties.includes(path)) return;

      const effectiveProp = getEffectiveProperty(path, prop);
      const type = getType(path, prop);
      const hasSubs =
        prop.subtemplate_properties &&
        Object.keys(prop.subtemplate_properties).length > 0;
      const indent = depth * 16;
      const x0 = M + indent;
      const fw = CW - indent;

      if (depth === 0) {
        // ── Top-level card ─────────────────────────────────────
        // Pre-compute content height for the card background
        const lblLines = wrap(effectiveProp.label, fw - 48, fontBold, 11);
        const descLines = effectiveProp.description
          ? wrap(effectiveProp.description, fw - 20, fontItalic, 8)
          : [];
        const headerH =
          10 +
          lblLines.length * 14 +
          (descLines.length > 0 ? descLines.length * 11 + 4 : 0) +
          8;

        need(headerH + 30);

        // Card background
        page.drawRectangle({
          x: x0,
          y: py(y + headerH),
          width: fw,
          height: headerH,
          color: primaryBg,
          borderWidth: 0,
        });
        // Left accent bar on card
        page.drawRectangle({
          x: x0,
          y: py(y + headerH),
          width: 3,
          height: headerH,
          color: primary,
        });

        y += 10;

        // Label + property ID link on same line
        for (let i = 0; i < lblLines.length; i++) {
          const lx = x0 + 10;

          drawText(lblLines[i], lx, 11, fontBold, primary);
          if (i === 0) {
            // Property ID link after first label line
            const lblW = fontBold.widthOfTextAtSize(lblLines[0], 11);

            drawPropertyLink(
              path.split(".").pop() ?? path,
              lx + lblW + 8,
              effectiveProp.class_id,
            );
          }
          y += 14;
        }

        // Description
        if (descLines.length > 0) {
          y += 2;
          for (const dl of descLines) {
            drawText(dl, x0 + 10, 8, fontItalic, muted);
            y += 11;
          }
        }
        y += 4;

        // Form field
        const valueForField = getValueForPath(path, prop);

        await drawField(
          type,
          x0 + 10,
          fw - 16,
          path.split(".").pop() ?? path,
          effectiveProp,
          path,
          valueForField,
        );

        // Sub-properties
        if (hasSubs) {
          for (const [sid, sp] of Object.entries(
            prop.subtemplate_properties!,
          )) {
            const subPath = `${path}.${sid}`;

            if (removedBuiltinProperties.includes(subPath)) continue;
            await renderProperty(subPath, sp, depth + 1);
          }
        }

        for (const nid of nestedCustomBlocks[path] ?? []) {
          const c = customBlocks[nid];

          if (c) await renderCustomBlock(c);
        }

        y += 8; // Card bottom spacing
      } else {
        // ── Nested property ────────────────────────────────────
        const lblLines = wrap(effectiveProp.label, fw - 20, fontBold, 9.5);
        const descLines = effectiveProp.description
          ? wrap(effectiveProp.description, fw - 20, fontItalic, 7.5)
          : [];
        const blockH =
          6 +
          lblLines.length * 13 +
          10 +
          (descLines.length > 0 ? descLines.length * 10 + 2 : 0) +
          30;

        need(blockH);

        const blockTopY = y;

        y += 6;

        // Label
        for (let i = 0; i < lblLines.length; i++) {
          drawText(lblLines[i], x0 + 10, 9.5, fontBold, dark);
          if (i === 0) {
            const lblW = fontBold.widthOfTextAtSize(lblLines[0], 9.5);

            drawPropertyLink(
              path.split(".").pop() ?? path,
              x0 + 10 + lblW + 6,
              effectiveProp.class_id,
            );
          }
          y += 13;
        }

        // Cardinality
        if (effectiveProp.cardinality) {
          drawText(effectiveProp.cardinality, x0 + 10, 7, fontItalic, subtle);
          y += 9;
        }

        // Description
        if (descLines.length > 0) {
          for (const dl of descLines) {
            drawText(dl, x0 + 10, 7.5, fontItalic, muted);
            y += 10;
          }
          y += 2;
        }

        // Form field
        const valueForField = getValueForPath(path, prop);

        await drawField(
          type,
          x0 + 10,
          fw - 16,
          path.split(".").pop() ?? path,
          effectiveProp,
          path,
          valueForField,
        );

        // Sub-properties
        if (hasSubs) {
          for (const [sid, sp] of Object.entries(
            prop.subtemplate_properties!,
          )) {
            const subPath = `${path}.${sid}`;

            if (removedBuiltinProperties.includes(subPath)) continue;
            await renderProperty(subPath, sp, depth + 1);
          }
        }

        for (const nid of nestedCustomBlocks[path] ?? []) {
          const c = customBlocks[nid];

          if (c) await renderCustomBlock(c);
        }

        // Left accent border for this block
        const bh = y - blockTopY;

        page.drawRectangle({
          x: x0 + 2,
          y: py(y),
          width: 2,
          height: bh,
          color: accent,
        });

        y += 4;
      }
    };

    const renderCustomBlock = async (block: CustomBlock) => {
      const x0 = M;
      const fw = CW;

      if (block.type === "text") {
        if (block.heading) {
          const lines = wrap(block.heading, fw - 20, fontBold, 11);

          for (const ln of lines) {
            need(14);
            drawText(ln, x0 + 10, 11, fontBold, primary);
            y += 14;
          }
          y += 2;
        }
        if (block.body) {
          const lines = wrap(block.body, fw - 20, fontItalic, 9);

          for (const ln of lines) {
            need(11);
            drawText(ln, x0 + 10, 9, fontItalic, muted);
            y += 11;
          }
        }
        y += 10;
      } else if (block.type === "section") {
        need(20);
        page.drawLine({
          start: { x: x0, y: py(y) },
          end: { x: x0 + fw, y: py(y) },
          thickness: 0.75,
          color: divider,
        });
        y += 8;
        const titleLines = wrap(
          block.title || "Section",
          fw - 20,
          fontBold,
          11,
        );

        for (const ln of titleLines) {
          need(14);
          drawText(ln, x0 + 10, 11, fontBold, primary);
          y += 14;
        }
        page.drawLine({
          start: { x: x0, y: py(y) },
          end: { x: x0 + fw, y: py(y) },
          thickness: 0.5,
          color: divider,
        });
        y += 12;
        const sectionChildIds = block.childIds ?? [];

        for (const cid of sectionChildIds) {
          const child = customBlocks[cid];

          if (child) await renderCustomBlock(child);
        }
      } else if (block.type === "customField") {
        need(40);
        const lblLines = wrap(block.label, fw - 48, fontBold, 11);
        const descLines = block.description
          ? wrap(block.description, fw - 20, fontItalic, 8)
          : [];
        const headerH =
          10 +
          lblLines.length * 14 +
          (descLines.length > 0 ? descLines.length * 11 + 4 : 0) +
          8;

        need(headerH + 30);
        page.drawRectangle({
          x: x0,
          y: py(y + headerH),
          width: fw,
          height: headerH,
          color: primaryBg,
          borderWidth: 0,
        });
        page.drawRectangle({
          x: x0,
          y: py(y + headerH),
          width: 3,
          height: headerH,
          color: primary,
        });
        y += 10;
        for (const ln of lblLines) {
          drawText(ln, x0 + 10, 11, fontBold, primary);
          y += 14;
        }
        if (descLines.length > 0) {
          y += 2;
          for (const dl of descLines) {
            drawText(dl, x0 + 10, 8, fontItalic, muted);
            y += 11;
          }
        }
        y += 4;
        const opts =
          block.type === "customField" &&
          block.inputType === "select" &&
          block.selectOptions
            ? block.selectOptions.map((o) => ({
                value: o.value,
                label: (o.label || o.value).replace(
                  /[^\x20-\x7E\xA0-\xFF]/g,
                  "?",
                ),
              }))
            : block.type === "customField" &&
                block.inputType === "scale" &&
                block.scaleConfig
              ? (() => {
                  const sc = block.scaleConfig;
                  const labels: { value: string; label: string }[] = [];

                  for (let i = sc.min; i <= sc.max; i++) {
                    if (i === sc.min && sc.minLabel) {
                      labels.push({ value: String(i), label: sc.minLabel });
                    } else if (i === sc.max && sc.maxLabel) {
                      labels.push({ value: String(i), label: sc.maxLabel });
                    } else {
                      labels.push({ value: String(i), label: String(i) });
                    }
                  }

                  return labels;
                })()
              : [];
        const customDrawField = async (
          type: InputType,
          x: number,
          w: number,
          fieldValue?: FormValue,
        ) => {
          const name = `f_${fc++}`;

          if (type === "checkbox") {
            need(18);
            const cb = form.createCheckBox(name);

            cb.addToPage(page, {
              x,
              y: py(y + 14),
              width: 14,
              height: 14,
              borderColor: fieldBdr,
              borderWidth: 1,
            });
            if (toBool(fieldValue)) {
              cb.check();
            }
            y += 20;
          } else if (
            (type === "select" || type === "scale") &&
            opts.length > 0
          ) {
            need(26);
            const dd = form.createDropdown(name);

            dd.addOptions(opts.map((o) => o.label));
            dd.addToPage(page, {
              x,
              y: py(y + 22),
              width: w,
              height: 22,
              borderColor: fieldBdr,
              borderWidth: 1,
              backgroundColor: fieldFill,
            });
            const valueStr =
              Array.isArray(fieldValue) && fieldValue.length > 0
                ? String(fieldValue[0])
                : typeof fieldValue === "string" ||
                    typeof fieldValue === "number"
                  ? String(fieldValue)
                  : undefined;

            if (valueStr) {
              const match = opts.find((opt) => opt.value === valueStr);

              if (match) {
                dd.select(match.label);
              }
            }
            y += 28;
          } else {
            const h = type === "textarea" ? 44 : 22;

            need(h + 4);
            const tf = form.createTextField(name);

            if (type === "textarea") tf.enableMultiline();
            tf.addToPage(page, {
              x,
              y: py(y + h),
              width: w,
              height: h,
              borderColor: fieldBdr,
              borderWidth: 1,
              backgroundColor: fieldFill,
            });
            const display = toDisplayString(fieldValue);

            if (display) {
              tf.setText(display);
            }
            y += h + 6;
          }
        };

        const customValue = values[CUSTOM_PREFIX + block.id];

        await customDrawField(block.inputType, x0 + 10, fw - 16, customValue);
        y += 8;
      } else if (block.type === "html" && block.html) {
        const stripped = block.html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        if (stripped) {
          const lines = wrap(stripped, fw - 20, fontItalic, 9);

          for (const ln of lines) {
            need(11);
            drawText(ln, x0 + 10, 9, fontItalic, muted);
            y += 11;
          }
        }
        y += 10;
      }
    };

    for (const block of orderedBlocks) {
      if (block.kind === "property") {
        if (removedBuiltinProperties.includes(block.id)) continue;
        const prop = mapping[block.id];

        if (prop) await renderProperty(block.id, prop, 0);
      } else {
        const custom = customBlocks[block.id];

        if (custom) await renderCustomBlock(custom);
      }
    }

    form.updateFieldAppearances(font);

    // ── Add link annotations (deferred to avoid corrupting form widgets) ──
    try {
      const ctx = pdfDoc.context;

      for (const link of pendingLinks) {
        const annotObj = ctx.obj({
          Type: "Annot",
          Subtype: "Link",
          Rect: [
            link.x,
            py(link.yTop + link.h),
            link.x + link.w,
            py(link.yTop - 2),
          ],
          Border: [0, 0, 0],
          A: { Type: "Action", S: "URI", URI: PDFString.of(link.url) },
        });
        const ref = ctx.register(annotObj);
        const annots = link.pageRef.node.get(PDFName.of("Annots"));

        if (annots && "push" in annots) {
          (annots as { push: (a: unknown) => void }).push(ref);
        } else {
          link.pageRef.node.set(PDFName.of("Annots"), ctx.obj([ref]));
        }
      }
    } catch (linkErr) {
      console.warn("PDF link annotations failed (non-blocking):", linkErr);
    }

    // ── Footer ─────────────────────────────────────────────────
    const total = pages.length;

    pages.forEach((p, i) => {
      const ft = `Page ${i + 1} of ${total}`;
      const fw = font.widthOfTextAtSize(ft, 7.5);

      p.drawLine({
        start: { x: M, y: 38 },
        end: { x: W - M, y: 38 },
        thickness: 0.5,
        color: divider,
      });
      p.drawText(ft, {
        x: (W - fw) / 2,
        y: 26,
        size: 7.5,
        font,
        color: muted,
      });
    });

    const bytes = await pdfDoc.save();
    //@ts-ignore
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `questionnaire-${templateId.replace(/[^a-zA-Z0-9_-]/g, "_")}-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("PDF export error:", err);
    alert(
      `PDF export failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
