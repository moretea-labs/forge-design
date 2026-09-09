// GENERATED FILE. DO NOT EDIT.
// Source of truth: schemas/*.schema.json via scripts/generate-schema-types.mjs.

export type DesignProjectManifest = {
  "schemaVersion": 1;
  "id": string;
  "name": string;
  "storageVersion": "1.0.0" | "1.1.0";
  "designSystem": {
    "name": string;
    "version": string;
  };
  "activeScreenId": string;
};

export type DesignTokens = ({
  "schemaVersion": 1;
  "meta": ({
    "name": string;
    "version": string;
  } & Record<string, unknown>);
  "color": Record<string, string>;
  "colorModes"?: {
    "light"?: Record<string, string>;
    "dark"?: Record<string, string>;
  };
  "spacing": Record<string, number>;
  "radius": Record<string, number>;
  "shadow": Record<string, string>;
  "typography": Record<string, ({
    "size": number;
    "lineHeight": number;
    "weight": number;
  } & Record<string, unknown>)>;
  "device": ({
    "iphoneWidth": number;
    "iphoneHeight": number;
    "safeTop": number;
    "safeBottom": number;
  } & Record<string, unknown>);
} & Record<string, unknown>);

export type ComponentContractsDocument = {
  "schemaVersion": 1;
  "components": Array<{
    "name": string;
    "purpose": string;
    "category": "layout" | "content" | "control" | "navigation";
    "allowedProps"?: Array<string>;
    "props"?: Array<{
      "name": string;
      "type": "string" | "number" | "boolean" | "enum";
      "required": boolean;
      "description": string;
      "enumValues"?: Array<string>;
    }>;
    "variants"?: Array<{
      "id": string;
      "name": string;
      "description"?: string;
    }>;
    "states"?: Array<{
      "id": string;
      "name": string;
      "description"?: string;
    }>;
    "interactionRole"?: "display" | "navigation" | "primary_action" | "secondary_action" | "destructive_action" | "input" | "selection" | "toggle" | "disclosure" | "status";
    "layout"?: {
      "axis"?: "none" | "vertical" | "horizontal" | "overlay";
      "width"?: "fill" | "hug";
      "alignment"?: "leading" | "center" | "trailing" | "stretch";
      "description"?: string;
    };
    "accessibility"?: {
      "summary": string;
      "traits": Array<"header" | "button" | "adjustable" | "image" | "summary" | "static_text">;
    };
    "implementation"?: {
      "platform": "swiftui" | "android" | "web" | "other";
      "symbol": string;
      "module"?: string;
    };
    "preview"?: {
      "nodes": Array<{
        "id": string;
        "primitive": "stack" | "text" | "icon" | "surface" | "divider" | "spacer" | "button" | "value" | "badge" | "progress";
        "parentId"?: string;
        "content"?: {
          "kind": "literal" | "prop";
          "value": string;
          "fallback"?: string;
        };
        "iconName"?: string;
        "style"?: {
          "axis"?: "vertical" | "horizontal";
          "gap"?: string;
          "padding"?: string;
          "typography"?: string;
          "color"?: string;
          "background"?: string;
          "radius"?: string;
          "alignment"?: "leading" | "center" | "trailing" | "stretch";
          "justify"?: "start" | "center" | "between" | "end";
          "width"?: "fill" | "hug";
        };
        "when"?: {
          "variants"?: Array<string>;
          "states"?: Array<string>;
        };
      }>;
    };
  }>;
};

export type ProductDesignModel = {
  "schemaVersion": 1;
  "brief": {
    "status": "draft" | "ready";
    "userJob": string;
    "productGoal": string;
    "businessSemantics": Array<string>;
    "primaryTasks": Array<string>;
    "secondaryTasks": Array<string>;
    "informationHierarchy": Array<{
      "role": "identity" | "primary_meaning" | "evidence" | "action" | "status" | "next_action" | "context" | "supporting_metadata";
      "description": string;
      "priority": "primary" | "secondary" | "supporting";
    }>;
    "stateModel": Array<{
      "id": string;
      "meaning": string;
      "userImpact": string;
    }>;
    "interactionModel": Array<{
      "id": string;
      "semantics": string;
      "patternId"?: string;
    }>;
    "screenFamily": string;
    "nonGoals": Array<string>;
    "preservedSemantics": Array<string>;
  };
  "flows": Array<{
    "id": string;
    "name": string;
    "userJob": string;
    "screenIds": Array<string>;
    "status": "draft" | "candidate" | "validated";
    "entry"?: {
      "screenId": string;
      "stateId"?: string;
    };
    "transitions"?: Array<{
      "id": string;
      "from": {
        "screenId": string;
        "stateId"?: string;
      };
      "trigger": {
        "interactionId": string;
        "event"?: string;
      };
      "guard"?: string;
      "commitBoundary": {
        "kind": "none" | "local_state" | "durable_write" | "coordinated_writes";
        "description"?: string;
      };
      "result": string;
      "to": {
        "screenId": string;
        "stateId"?: string;
      };
      "recovery"?: Array<{
        "condition": string;
        "target": {
          "screenId": string;
          "stateId"?: string;
        };
        "result": string;
      }>;
    }>;
  }>;
  "patterns": Array<{
    "id": string;
    "name": string;
    "semanticPurpose": string;
    "status": "local" | "golden_candidate" | "approved";
    "validatedFlowIds": Array<string>;
    "siblingEvidence": Array<string>;
    "owner"?: string;
    "canonicalComponent"?: string;
  }>;
  "golden": {
    "status": "draft" | "candidate" | "approved";
    "screenIds": Array<string>;
    "flowIds": Array<string>;
    "patternIds": Array<string>;
    "review": {
      "stage": "not_started" | "captured" | "model_visible" | "visual_reviewed";
      "userDecision": "pending" | "accepted" | "rejected";
      "artifactRefs": Array<string>;
      "notes": Array<string>;
    };
  };
};

export type ScreenSpec = {
  "schemaVersion": 1;
  "id": string;
  "name": string;
  "device": "iphone-16-pro";
  "goal": string;
  "primaryAction": string;
  "constraints": Array<string>;
  "nodes": Array<{
    "id": string;
    "component": string;
    "props"?: Record<string, unknown>;
    "variant"?: string;
    "state"?: string;
    "interactionPatternId"?: string;
  }>;
  "initialStateId"?: string;
  "states"?: Array<{
    "id": string;
    "name": string;
    "meaning": string;
    "primaryAction"?: string;
    "constraints"?: Array<string>;
    "nodes"?: Array<{
      "id": string;
      "component": string;
      "props"?: Record<string, unknown>;
      "variant"?: string;
      "state"?: string;
      "interactionPatternId"?: string;
    }>;
  }>;
};

export type DesignUnitsDocument = {
  "schemaVersion": 1;
  "reviewProfiles"?: Array<{
    "id": string;
    "name": string;
    "viewport": {
      "width": number;
      "height": number;
      "safeTop": number;
      "safeBottom": number;
    };
    "colorScheme": "light" | "dark";
    "textScale": number;
    "contrast": "standard" | "increased";
    "reduceMotion": boolean;
  }>;
  "units": Array<{
    "id": string;
    "name": string;
    "screenFamily": string;
    "screenIds": Array<string>;
    "contractRefs": Array<{
      "revision": string;
      "path": string;
      "section"?: string;
      "anchor"?: string;
    }>;
    "review"?: {
      "status": "draft" | "review" | "visual_reviewed" | "rejected";
      "profileIds": Array<string>;
      "artifactRefs": Array<string>;
      "notes": Array<string>;
      "acceptance"?: {
        "acceptedRevision": string;
        "designDigest": string;
        "acceptedAt": string;
        "artifactRefs": Array<string>;
        "note"?: string;
      };
    };
  }>;
  "freeze"?: {
    "status": "frozen";
    "frozenRevision": string;
    "frozenAt": string;
    "unitDigests": Array<{
      "unitId": string;
      "designDigest": string;
      "acceptedRevision": string;
    }>;
    "profileIds": Array<string>;
    "artifactRefs": Array<string>;
    "note"?: string;
  };
};
