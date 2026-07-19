import { createHash } from "node:crypto";
import { DdexCompressionService, DdexXmlSerializer, type DdexXmlNode } from "./xml";
import { DdexErnMapper, DdexMeadMapper, DdexRinMapper } from "./mapper";
import { DdexValidator, type DdexValidationResult } from "./validator";
import type {
  DdexErnMessage,
  DdexExportArtifact,
  DdexExportOptions,
  DdexMeadMessage,
  DdexRinMessage,
  DdexSchemaVersion,
  DdexSignatureProvider,
  DdexMessageType,
} from "./types";
import type { DdexSourceRelease } from "./types";

function hashXml(xml: string): string {
  return createHash("sha256").update(xml).digest("hex");
}

function messageNamespace(messageType: DdexMessageType, schemaVersion: DdexSchemaVersion): Readonly<Record<string, string>> {
  const ernNamespace = schemaVersion === "4.0" ? "http://ddex.net/xml/ern/40" : schemaVersion === "4.1" ? "http://ddex.net/xml/ern/41" : schemaVersion === "4.2" ? "http://ddex.net/xml/ern/42" : "http://ddex.net/xml/ern/43";
  const base = {
    ern: ernNamespace,
    mead: "http://ddex.net/xml/mead/10",
    rin: "http://ddex.net/xml/rin/20",
    xsi: "http://www.w3.org/2001/XMLSchema-instance",
    ds: "http://www.w3.org/2000/09/xmldsig#",
  };
  return messageType === "RecordingInformationNotification" ? { ...base, rin: base.rin } : base;
}

function buildRootNode(messageType: DdexMessageType, schemaVersion: DdexSchemaVersion, body: DdexXmlNode, signatureXml: string | null): DdexXmlNode {
  const namespace = messageType === "RecordingInformationNotification" ? "rin" : messageType === "UpdateMessage" ? "mead" : "ern";
  const namespaceMap = messageNamespace(messageType, schemaVersion);
  const rootName = `${namespace}:${messageType}`;
  const signatureNode = signatureXml ? { name: `${namespace}:SignaturePlaceholder`, rawXml: signatureXml } : null;
  return {
    name: rootName,
    attributes: {
      "xmlns:ern": namespaceMap.ern,
      "xmlns:mead": namespaceMap.mead,
      "xmlns:rin": namespaceMap.rin,
      "xmlns:ds": namespaceMap.ds,
      "xmlns:xsi": namespaceMap.xsi,
      version: schemaVersion,
    },
    children: signatureNode ? [body, signatureNode] : [body],
  };
}

function wrapMessageHeader(message: DdexErnMessage["messageHeader"] | DdexMeadMessage["messageHeader"] | DdexRinMessage["messageHeader"]): DdexXmlNode {
  return {
    name: "MessageHeader",
    children: [
      { name: "MessageId", text: message.messageId },
      { name: "MessageType", text: message.messageType },
      { name: "MessageSender", text: message.sender },
      { name: "MessageRecipient", text: message.recipient },
      { name: "MessageCreationDateTime", text: message.creationDateTime },
      { name: "SchemaVersion", text: message.schemaVersion },
    ],
  };
}

export class DdexFoundationService {
  constructor(
    private readonly ernMapper: DdexErnMapper,
    private readonly meadMapper: DdexMeadMapper,
    private readonly rinMapper: DdexRinMapper,
    private readonly validator: DdexValidator,
    private readonly serializer: DdexXmlSerializer,
    private readonly compressor: DdexCompressionService,
    private readonly signatureProvider: DdexSignatureProvider | null,
  ) {}

  exportNewRelease(release: DdexSourceRelease, options: DdexExportOptions = {}): DdexExportArtifact {
    return this.exportMessage(this.ernMapper.mapNewRelease(release, options), options);
  }

  exportUpdateRelease(release: DdexSourceRelease, options: DdexExportOptions = {}): DdexExportArtifact {
    return this.exportMessage(this.ernMapper.mapUpdateRelease(release, options), options);
  }

  exportTakedownRelease(release: DdexSourceRelease, options: DdexExportOptions = {}): DdexExportArtifact {
    return this.exportMessage(this.ernMapper.mapTakedownRelease(release, options), options);
  }

  exportMead(release: DdexSourceRelease, updates: Parameters<DdexMeadMapper["map"]>[1], options: DdexExportOptions = {}): DdexExportArtifact {
    return this.exportMessage(this.meadMapper.map(release, updates, options), options);
  }

  exportRin(release: DdexSourceRelease, options: DdexExportOptions = {}): DdexExportArtifact {
    return this.exportMessage(this.rinMapper.map(release, options), options);
  }

  validateErn(message: DdexErnMessage): DdexValidationResult {
    return this.validator.validateErn(message);
  }

  validateMead(message: DdexMeadMessage): DdexValidationResult {
    return this.validator.validateMead(message);
  }

  validateRin(message: DdexRinMessage): DdexValidationResult {
    return this.validator.validateRin(message);
  }

  private exportMessage(message: DdexErnMessage | DdexMeadMessage | DdexRinMessage, options: DdexExportOptions): DdexExportArtifact {
    const schemaVersion = message.messageHeader.schemaVersion;
    const body = this.createBody(message);
    const signatureXml = this.signatureProvider?.createSignatureXml(
      this.serializer.serialize(buildRootNode(message.messageHeader.messageType, schemaVersion, body, null), { declaration: false }),
      options.signatureMetadata ?? {},
    ) ?? null;
    const document = this.serializer.serialize(buildRootNode(message.messageHeader.messageType, schemaVersion, body, signatureXml));
    const compressed = options.compress === false ? null : this.compressor.compress(document);
    return Object.freeze({
      messageType: message.messageHeader.messageType,
      schemaVersion,
      xml: document,
      compressed,
      checksum: hashXml(document),
      format: compressed ? "xml+gzip" : "xml",
      metadata: Object.freeze({ ...(message.metadata ?? {}), ...(options.metadata ?? {}), compressed: Boolean(compressed) }),
    });
  }

  private createBody(message: DdexErnMessage | DdexMeadMessage | DdexRinMessage): DdexXmlNode {
    if (message.messageHeader.messageType === "RecordingInformationNotification") {
      const rinMessage = message as DdexRinMessage;
      return {
        name: "RinBody",
        children: [
          wrapMessageHeader(rinMessage.messageHeader),
          {
            name: "RecordingInformationNotification",
            children: [
              { name: "SessionId", text: rinMessage.sessionId },
              { name: "ReleaseId", text: rinMessage.releaseId },
              { name: "RecordingTitle", text: rinMessage.recordingTitle },
              { name: "RecordingDate", text: rinMessage.recordingDate },
              { name: "RecordingLocation", text: rinMessage.recordingLocation },
              this.createList("Studios", "Studio", rinMessage.studios),
              this.createContributorList("Engineers", "Engineer", rinMessage.engineers),
              this.createContributorList("Musicians", "Musician", rinMessage.musicians),
              this.createList("FeaturedArtists", "FeaturedArtist", rinMessage.featuredArtists),
              { name: "MixEngineer", text: rinMessage.mixEngineer },
              { name: "MasterEngineer", text: rinMessage.masterEngineer },
              { name: "Isrc", text: rinMessage.isrc },
              this.createIdentifierList(rinMessage.identifiers),
            ],
          },
        ],
      };
    }

    if (message.messageHeader.messageType === "UpdateMessage") {
      const meadMessage = message as DdexMeadMessage;
      return {
        name: "MeadBody",
        children: [
          wrapMessageHeader(meadMessage.messageHeader),
          {
            name: "MetadataUpdateMessage",
            children: [
              { name: "ReleaseId", text: meadMessage.releaseId },
              this.createMeadUpdate(meadMessage.updates),
            ],
          },
        ],
      };
    }

    const ernMessage = message as DdexErnMessage;
    return {
      name: "ErnBody",
      children: [
        wrapMessageHeader(ernMessage.messageHeader),
        {
          name: "ReleaseMessage",
          children: [
            this.createReleaseList(ernMessage.releaseList.releases),
            this.createResourceList(ernMessage.resourceList.resources),
            this.createPartyList(ernMessage.partyList.parties),
            this.createDealList(ernMessage.dealList.deals),
          ],
        },
      ],
    };
  }

  private createReleaseList(releases: DdexErnMessage["releaseList"]["releases"]): DdexXmlNode {
    return {
      name: "ReleaseList",
      children: releases.map((release) => ({
        name: "Release",
        children: [
          { name: "ReleaseId", text: release.releaseId },
          { name: "TitleText", text: release.title },
          { name: "VersionTitle", text: release.versionTitle },
          { name: "DisplayArtistName", text: release.primaryArtist },
          this.createList("FeaturedArtists", "ArtistName", release.featuredArtists),
          { name: "LabelName", text: release.label },
          { name: "ReleaseDate", text: release.releaseDate },
          { name: "OriginalReleaseDate", text: release.originalReleaseDate },
          { name: "ReleaseType", text: release.releaseType },
          { name: "Language", text: release.language },
          { name: "Genre", text: release.genre },
          { name: "SubGenre", text: release.subGenre },
          { name: "ParentalAdvisory", text: release.parentalAdvisory },
          { name: "Copyright", text: release.copyright },
          { name: "PLine", text: release.pLine },
          { name: "CLine", text: release.cLine },
          this.createIdentifierList(release.identifiers),
          this.createList("Territories", "TerritoryCode", release.territories),
          this.createTechnicalDetails(release.technicalDetails),
          this.createList("PartyRefs", "PartyRef", release.partyRefs),
          this.createList("ResourceRefs", "ResourceRef", release.resourceRefs),
          this.createList("DealRefs", "DealRef", release.dealRefs),
        ],
      })),
    };
  }

  private createResourceList(resources: DdexErnMessage["resourceList"]["resources"]): DdexXmlNode {
    return {
      name: "ResourceList",
      children: resources.map((resource) => {
        if (resource.resourceType === "SoundRecording") return this.createSoundRecording(resource);
        if (resource.resourceType === "Image") return this.createImage(resource);
        if (resource.resourceType === "Video") return this.createVideo(resource);
        return this.createText(resource);
      }),
    };
  }

  private createSoundRecording(resource: DdexErnMessage["resourceList"]["resources"][number] & { resourceType: "SoundRecording" }): DdexXmlNode {
    return {
      name: "SoundRecording",
      children: [
        { name: "ResourceId", text: resource.resourceId },
        { name: "Isrc", text: resource.isrc },
        { name: "TitleText", text: resource.title },
        { name: "SequenceNumber", text: resource.sequenceNumber },
        { name: "DiscNumber", text: resource.discNumber },
        { name: "Language", text: resource.language },
        { name: "Genre", text: resource.genre },
        { name: "SubGenre", text: resource.subGenre },
        this.createContributorList("Contributors", "Contributor", resource.contributors),
        this.createTechnicalDetails(resource.technicalDetails),
        this.createIdentifierList(resource.identifiers),
        this.createList("Territories", "TerritoryCode", resource.territories),
        { name: "ReleaseDate", text: resource.releaseDate },
        { name: "OriginalReleaseDate", text: resource.originalReleaseDate },
        { name: "Copyright", text: resource.copyright },
        { name: "PLine", text: resource.pLine },
        { name: "CLine", text: resource.cLine },
        { name: "PrimaryArtist", text: resource.primaryArtist },
        this.createList("FeaturedArtists", "ArtistName", resource.featuredArtists),
        { name: "AudioUrl", text: resource.audioUrl },
        { name: "PreviewUrl", text: resource.previewUrl },
        { name: "DurationSeconds", text: resource.durationSeconds },
        { name: "Explicit", text: resource.explicit },
        { name: "Lyrics", text: resource.lyrics },
      ],
    };
  }

  private createImage(resource: DdexErnMessage["resourceList"]["resources"][number] & { resourceType: "Image" }): DdexXmlNode {
    return {
      name: "Image",
      children: [
        { name: "ResourceId", text: resource.resourceId },
        { name: "Uri", text: resource.uri },
        { name: "TitleText", text: resource.title },
        { name: "Width", text: resource.width },
        { name: "Height", text: resource.height },
        { name: "Checksum", text: resource.checksum },
        { name: "AltText", text: resource.altText },
        this.createIdentifierList(resource.identifiers),
        this.createList("Territories", "TerritoryCode", resource.territories),
      ],
    };
  }

  private createVideo(resource: DdexErnMessage["resourceList"]["resources"][number] & { resourceType: "Video" }): DdexXmlNode {
    return {
      name: "Video",
      children: [
        { name: "ResourceId", text: resource.resourceId },
        { name: "Uri", text: resource.uri },
        { name: "TitleText", text: resource.title },
        { name: "Width", text: resource.width },
        { name: "Height", text: resource.height },
        { name: "Checksum", text: resource.checksum },
        { name: "DurationSeconds", text: resource.durationSeconds },
        this.createIdentifierList(resource.identifiers),
        this.createList("Territories", "TerritoryCode", resource.territories),
      ],
    };
  }

  private createText(resource: DdexErnMessage["resourceList"]["resources"][number] & { resourceType: "Text" }): DdexXmlNode {
    return {
      name: "Text",
      children: [
        { name: "ResourceId", text: resource.resourceId },
        { name: "Uri", text: resource.uri },
        { name: "TitleText", text: resource.title },
        { name: "Checksum", text: resource.checksum },
        { name: "TextContent", text: resource.text },
        this.createIdentifierList(resource.identifiers),
        this.createList("Territories", "TerritoryCode", resource.territories),
      ],
    };
  }

  private createPartyList(parties: DdexErnMessage["partyList"]["parties"]): DdexXmlNode {
    return {
      name: "PartyList",
      children: parties.map((party) => ({
        name: "Party",
        children: [
          { name: "PartyId", text: party.partyId },
          { name: "PartyName", text: party.name },
          this.createList("Roles", "Role", party.roles),
          { name: "IsPrimary", text: party.isPrimary },
        ],
      })),
    };
  }

  private createDealList(deals: DdexErnMessage["dealList"]["deals"]): DdexXmlNode {
    return {
      name: "DealList",
      children: deals.map((deal) => ({
        name: "Deal",
        children: [
          { name: "DealId", text: deal.dealId },
          { name: "CommercialModelType", text: deal.commercialModelType },
          { name: "RightsClaimPolicy", text: deal.rightsClaimPolicy },
          { name: "StartDate", text: deal.startDate },
          { name: "EndDate", text: deal.endDate },
          { name: "Preorder", text: deal.preorder },
          { name: "InstantGratification", text: deal.instantGratification },
          { name: "StreamingPreview", text: deal.streamingPreview },
          this.createList("Territories", "TerritoryCode", deal.territoryCodes),
          this.createList(
            "PriceInformationList",
            "PriceInformation",
            deal.priceInformation.map((price) => `${price.currencyCode}:${price.territoryCode}:${price.retailPrice}`),
          ),
          this.createList("DspSpecificRights", "Right", deal.dspSpecificRights),
        ],
      })),
    };
  }

  private createTechnicalDetails(details: DdexErnMessage["technicalDetails"][number]): DdexXmlNode {
    return {
      name: "TechnicalDetails",
      children: [
        { name: "MultiDisc", text: details.multiDisc },
        { name: "VersionedRelease", text: details.versionedRelease },
        { name: "Bundle", text: details.bundle },
        { name: "PreviewAvailable", text: details.previewAvailable },
        { name: "Explicit", text: details.explicit },
        { name: "ParentalAdvisory", text: details.parentalAdvisory },
        { name: "Format", text: details.format },
      ],
    };
  }

  private createIdentifierList(identifiers: readonly { type: string; value: string; scope: string; issuer: string | null }[]): DdexXmlNode {
    return {
      name: "IdentifierList",
      children: identifiers.map((identifier) => ({
        name: "Identifier",
        children: [
          { name: "Type", text: identifier.type },
          { name: "Value", text: identifier.value },
          { name: "Scope", text: identifier.scope },
          { name: "Issuer", text: identifier.issuer },
        ],
      })),
    };
  }

  private createList(listName: string, itemName: string, values: readonly unknown[]): DdexXmlNode {
    return {
      name: listName,
      children: values.map((value) => ({
        name: itemName,
        text: value == null ? null : String(value),
      })),
    };
  }

  private createContributorList(
    listName: string,
    itemName: string,
    contributors: readonly Readonly<{
      contributorId?: string;
      name: string;
      roles?: readonly string[];
      role?: string;
      splitPercentage?: number | null;
      ipi?: string | null;
      isPrimary?: boolean;
      featured?: boolean;
      publisher?: string | null;
      metadata?: Readonly<Record<string, unknown>>;
    }>[],
  ): DdexXmlNode {
    return {
      name: listName,
      children: contributors.map((contributor) => ({
        name: itemName,
        children: [
          { name: "ContributorId", text: contributor.contributorId ?? null },
          { name: "Name", text: contributor.name },
          this.createList("Roles", "Role", contributor.roles ?? (contributor.role ? [contributor.role] : [])),
          { name: "SplitPercentage", text: contributor.splitPercentage ?? null },
          { name: "Ipi", text: contributor.ipi ?? null },
          { name: "IsPrimary", text: contributor.isPrimary ?? null },
          { name: "Featured", text: contributor.featured ?? null },
          { name: "Publisher", text: contributor.publisher ?? null },
        ],
      })),
    };
  }

  private createMeadUpdate(update: DdexMeadMessage["updates"]): DdexXmlNode {
    return {
      name: "Update",
      children: [
        { name: "TitleText", text: update.title },
        update.artwork
          ? {
              name: "ArtworkUpdate",
              children: [
                { name: "Uri", text: update.artwork.uri },
                { name: "Checksum", text: update.artwork.checksum },
                { name: "Width", text: update.artwork.width },
                { name: "Height", text: update.artwork.height },
                { name: "AltText", text: update.artwork.altText },
              ],
            }
          : null,
        update.rights
          ? {
              name: "RightsUpdate",
              children: [
                { name: "Copyright", text: update.rights.copyright },
                { name: "PLine", text: update.rights.pLine },
                { name: "CLine", text: update.rights.cLine },
                this.createList("Territories", "TerritoryCode", update.rights.territories ?? []),
                { name: "RightsClaimPolicy", text: update.rights.rightsClaimPolicy },
              ],
            }
          : null,
        update.resources
          ? {
              name: "ResourceUpdates",
              children: update.resources.map((resource) => ({
                name: "ResourceUpdate",
                children: [
                  { name: "ResourceId", text: (resource as { resourceId?: string | undefined }).resourceId },
                  { name: "ResourceType", text: (resource as { resourceType?: string | undefined }).resourceType },
                  { name: "TitleText", text: (resource as { title?: string | undefined }).title },
                ],
              })),
            }
          : null,
        update.relationships
          ? {
              name: "Relationships",
              children: update.relationships.map((relationship) => ({
                name: "Relationship",
                children: [
                  { name: "RelationType", text: relationship.relationType },
                  { name: "SourceId", text: relationship.sourceId },
                  { name: "TargetId", text: relationship.targetId },
                ],
              })),
            }
          : null,
        this.createList("Territories", "TerritoryCode", update.territories ?? []),
      ].filter((entry): entry is DdexXmlNode => Boolean(entry)),
    };
  }
}
