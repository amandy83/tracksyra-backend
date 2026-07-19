import { gzipSync } from "node:zlib";

export type DdexXmlAttributeValue = string | number | boolean | null | undefined;

export type DdexXmlNode = Readonly<{
  name: string;
  attributes?: Readonly<Record<string, DdexXmlAttributeValue>>;
  children?: readonly DdexXmlNode[];
  text?: string | number | boolean | null;
  rawXml?: string | null;
}>;

export type DdexXmlDocumentOptions = Readonly<{
  declaration?: boolean;
  indent?: string;
  newline?: string;
}>;

export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function serializeAttributes(attributes: Readonly<Record<string, DdexXmlAttributeValue>> | undefined): string {
  if (!attributes) return "";
  return Object.entries(attributes)
    .filter(([, value]) => value !== null && value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => ` ${key}="${escapeXml(String(value))}"`)
    .join("");
}

function serializeNode(node: DdexXmlNode, options: DdexXmlDocumentOptions, depth: number): string {
  if (node.rawXml != null) {
    return node.rawXml;
  }

  const indent = options.indent ?? "  ";
  const newline = options.newline ?? "\n";
  const prefix = indent ? indent.repeat(depth) : "";
  const attributes = serializeAttributes(node.attributes);
  const text = node.text == null ? "" : escapeXml(String(node.text));
  const children = node.children ?? [];
  const hasChildren = children.length > 0;
  const hasText = text.length > 0;

  if (!hasChildren && !hasText) {
    return `${prefix}<${node.name}${attributes}/>`;
  }

  if (!hasChildren) {
    return `${prefix}<${node.name}${attributes}>${text}</${node.name}>`;
  }

  const renderedChildren = children.map((child) => serializeNode(child, options, depth + 1)).join(newline);
  const body = hasText ? `${text}${newline}${renderedChildren}` : renderedChildren;
  return `${prefix}<${node.name}${attributes}>${newline}${body}${newline}${prefix}</${node.name}>`;
}

export function serializeXmlDocument(root: DdexXmlNode, options: DdexXmlDocumentOptions = {}): string {
  const declaration = options.declaration ?? true;
  const newline = options.newline ?? "\n";
  const body = serializeNode(root, options, 0);
  return declaration ? `<?xml version="1.0" encoding="UTF-8"?>${newline}${body}${newline}` : `${body}${newline}`;
}

export class DdexCompressionService {
  constructor(private readonly enabled: boolean) {}

  compress(xml: string): Uint8Array | null {
    if (!this.enabled) return null;
    return gzipSync(Buffer.from(xml, "utf8"));
  }
}

export class DdexXmlSerializer {
  serialize(root: DdexXmlNode, options: DdexXmlDocumentOptions = {}): string {
    return serializeXmlDocument(root, options);
  }
}
