"use client";

import { useEffect } from "react";

const PATCH_FLAG = "__essaycraftDomMutationGuard";

type GuardedNode = Node & {
  [PATCH_FLAG]?: true;
  __essaycraftOriginalRemoveChild?: typeof Node.prototype.removeChild;
  __essaycraftOriginalInsertBefore?: typeof Node.prototype.insertBefore;
};

export function DomMutationGuard() {
  useEffect(() => {
    const proto = Node.prototype as GuardedNode;
    if (proto[PATCH_FLAG]) return;
    proto[PATCH_FLAG] = true;
    proto.__essaycraftOriginalRemoveChild = proto.removeChild;
    proto.__essaycraftOriginalInsertBefore = proto.insertBefore;

    proto.removeChild = function guardedRemoveChild<T extends Node>(child: T): T {
      if (child.parentNode !== this) {
        warnDomMismatch("removeChild", this, child);
        return child;
      }
      return proto.__essaycraftOriginalRemoveChild!.call(this, child) as T;
    };

    proto.insertBefore = function guardedInsertBefore<T extends Node>(node: T, child: Node | null): T {
      if (child && child.parentNode !== this) {
        warnDomMismatch("insertBefore", this, child);
        return proto.__essaycraftOriginalInsertBefore!.call(this, node, null) as T;
      }
      return proto.__essaycraftOriginalInsertBefore!.call(this, node, child) as T;
    };
  }, []);

  return null;
}

function warnDomMismatch(action: string, parent: Node, child: Node) {
  if (process.env.NODE_ENV !== "development") return;
  const parentName = parent instanceof Element ? parent.tagName.toLowerCase() : parent.nodeName;
  const childName = child instanceof Element ? child.tagName.toLowerCase() : child.nodeName;
  console.warn(`[EssayCraft] Ignored stale DOM ${action} request (${parentName} -> ${childName}).`);
}
