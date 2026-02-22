"use client";

import type {
  EnrichedTemplateMapping,
  SubtemplateProperty,
} from "@/types/template";
import type { InputType } from "@/types/template";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@heroui/button";
import { PDFDocument, PDFName, PDFString, StandardFonts, rgb } from "pdf-lib";

import { TemplatePropertyRenderer } from "./TemplatePropertyRenderer";
import {
  getInputTypeForProperty,
  getInputTypeFromValueType,
} from "./input-type-utils";

import { getOrkgPropertyLink, getOrkgClassLink } from "@/lib/orkg-links";

type PropertyValue = string | number | boolean | string[];
export type FormValue =
  | PropertyValue
  | { _?: PropertyValue; [key: string]: FormValue | undefined };

function createEmptyValue(prop: SubtemplateProperty): FormValue {
  if (
    prop.subtemplate_properties &&
    Object.keys(prop.subtemplate_properties).length > 0
  ) {
    const obj: Record<string, FormValue> = { _: "" };

    for (const subId of Object.keys(prop.subtemplate_properties)) {
      obj[subId] = createEmptyValue(prop.subtemplate_properties[subId]);
    }

    return obj;
  }

  return "";
}

function buildInitialValues(
  mapping: EnrichedTemplateMapping,
): Record<string, FormValue> {
  const values: Record<string, FormValue> = {};

  for (const [id, prop] of Object.entries(mapping)) {
    values[id] = createEmptyValue(prop);
  }

  return values;
}

function flattenForJson(v: FormValue, prop: SubtemplateProperty): unknown {
  if (v === undefined || v === null) return undefined;
  if (v === "" || (Array.isArray(v) && v.length === 0)) return undefined;
  if (typeof v === "object" && !Array.isArray(v) && v !== null) {
    const obj: Record<string, unknown> = {};
    const nested = prop.subtemplate_properties;

    if (nested && "_" in v && v._ !== undefined && v._ !== "") {
      obj.value = v._;
    }
    if (nested) {
      for (const [k, subProp] of Object.entries(nested)) {
        const subVal = (v as Record<string, FormValue>)[k];
        const flattened = flattenForJson(subVal, subProp);

        if (flattened !== undefined) obj[k] = flattened;
      }
    }

    return Object.keys(obj).length > 0 ? obj : undefined;
  }

  return v;
}

interface QuestionnaireFormProps {
  templateId: string;
  label: string;
  mapping: EnrichedTemplateMapping;
  backHref?: string;
}

export function QuestionnaireForm({
  templateId,
  label,
  mapping,
  backHref = "/",
}: QuestionnaireFormProps) {
  const [values, setValues] = useState<Record<string, FormValue>>(() =>
    buildInitialValues(mapping),
  );

  const getValue = useCallback(
    (propertyId: string, hasSub: boolean): FormValue => {
      const v = values[propertyId];

      if (v === undefined) return hasSub ? { _: "" } : "";

      return v;
    },
    [values],
  );

  const setValue = useCallback((propertyId: string, value: FormValue) => {
    setValues((prev) => ({ ...prev, [propertyId]: value }));
  }, []);

  const handleExportJson = useCallback(() => {
    const exportData: Record<string, unknown> = {
      templateId,
      templateLabel: label,
      exportedAt: new Date().toISOString(),
      answers: {},
    };

    for (const [propId, prop] of Object.entries(mapping)) {
      const v = values[propId];
      const flattened = flattenForJson(v, prop);

      if (flattened !== undefined) {
        (exportData.answers as Record<string, unknown>)[propId] = flattened;
      }
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `questionnaire-${templateId}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [templateId, label, mapping, values]);

  const handleExportPdf = useCallback(async () => {
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
      const drawPropertyLink = (
        propId: string,
        x: number,
        classId?: string,
      ) => {
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

      const getType = (pid: string, prop: SubtemplateProperty): InputType => {
        const e = prop as { valueType?: string };

        return e.valueType !== undefined
          ? getInputTypeFromValueType(e.valueType as never)
          : getInputTypeForProperty(pid);
      };

      const fetchOptions = async (
        pid: string,
        cid?: string,
      ): Promise<string[]> => {
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
              const lbl = r.label || r.id.split("/").pop() || r.id;

              return lbl.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
            },
          );
        } catch {
          return [];
        }
      };

      // ── Draw a form field ──────────────────────────────────────
      const drawField = async (
        type: InputType,
        x: number,
        w: number,
        pid: string,
        prop: SubtemplateProperty,
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
          y += 20;
        } else if (type === "resource" || type === "select") {
          need(26);
          const opts =
            type === "resource"
              ? await fetchOptions(pid, prop.class_id)
              : ["Option 1", "Option 2", "Option 3", "Other"];

          if (opts.length > 0) {
            const dd = form.createDropdown(name);

            dd.addOptions(opts);
            dd.addToPage(page, {
              x,
              y: py(y + 22),
              width: w,
              height: 22,
              borderColor: fieldBdr,
              borderWidth: 1,
              backgroundColor: fieldFill,
            });
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
        pid: string,
        prop: SubtemplateProperty,
        depth: number,
      ) => {
        const type = getType(pid, prop);
        const hasSubs =
          prop.subtemplate_properties &&
          Object.keys(prop.subtemplate_properties).length > 0;
        const indent = depth * 16;
        const x0 = M + indent;
        const fw = CW - indent;

        if (depth === 0) {
          // ── Top-level card ─────────────────────────────────────
          // Pre-compute content height for the card background
          const lblLines = wrap(prop.label, fw - 48, fontBold, 11);
          const descLines = prop.description
            ? wrap(prop.description, fw - 20, fontItalic, 8)
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

              drawPropertyLink(pid, lx + lblW + 8, prop.class_id);
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
          await drawField(type, x0 + 10, fw - 16, pid, prop);

          // Sub-properties
          if (hasSubs) {
            for (const [sid, sp] of Object.entries(
              prop.subtemplate_properties!,
            )) {
              await renderProperty(sid, sp, depth + 1);
            }
          }

          y += 8; // Card bottom spacing
        } else {
          // ── Nested property ────────────────────────────────────
          const lblLines = wrap(prop.label, fw - 20, fontBold, 9.5);
          const descLines = prop.description
            ? wrap(prop.description, fw - 20, fontItalic, 7.5)
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

              drawPropertyLink(pid, x0 + 10 + lblW + 6, prop.class_id);
            }
            y += 13;
          }

          // Cardinality
          if (prop.cardinality) {
            drawText(prop.cardinality, x0 + 10, 7, fontItalic, subtle);
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
          await drawField(type, x0 + 10, fw - 16, pid, prop);

          // Sub-properties
          if (hasSubs) {
            for (const [sid, sp] of Object.entries(
              prop.subtemplate_properties!,
            )) {
              await renderProperty(sid, sp, depth + 1);
            }
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

      for (const [pid, prop] of Object.entries(mapping)) {
        await renderProperty(pid, prop, 0);
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
  }, [templateId, label, mapping]);

  const entries = useMemo(
    () => Object.entries(mapping) as [string, SubtemplateProperty][],
    [mapping],
  );

  return (
    <section className="flex flex-col gap-8 py-8">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            as={Link}
            color="primary"
            href={backHref}
            size="sm"
            variant="flat"
          >
            ← Back to templates
          </Button>
          <Button
            color="primary"
            size="sm"
            variant="bordered"
            onPress={handleExportJson}
          >
            Export answers (JSON)
          </Button>
          <Button
            color="primary"
            size="sm"
            variant="bordered"
            onPress={() => void handleExportPdf()}
          >
            Export fillable PDF
          </Button>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary md:text-3xl">
            {label}
          </h1>
          <p className="mt-1 text-default-500">Template ID: {templateId}</p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {entries.map(([propertyId, property]) => (
          <TemplatePropertyRenderer
            key={propertyId}
            property={property}
            propertyId={propertyId}
            value={getValue(
              propertyId,
              !!property.subtemplate_properties?.length,
            )}
            onValueChange={(v) => setValue(propertyId, v)}
          />
        ))}
      </div>
    </section>
  );
}
