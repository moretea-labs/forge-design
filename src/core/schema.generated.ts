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
    "allowedProps": Array<string>;
    "category": "layout" | "content" | "control" | "navigation";
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
  }>;
  "patterns": Array<{
    "id": string;
    "name": string;
    "semanticPurpose": string;
    "status": "local" | "golden_candidate" | "approved";
    "validatedFlowIds": Array<string>;
    "siblingEvidence": Array<string>;
    "owner"?: string;
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
  }>;
};

export type DesignUnitsDocument = {
  "schemaVersion": 1;
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
  }>;
};
