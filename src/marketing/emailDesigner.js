export const ROOT_EMAIL_CONTAINER = "root";

const columnSeparator = "::column::";

export function emailColumnId(layoutId, columnIndex) {
  return `${layoutId}${columnSeparator}${columnIndex}`;
}

function parseColumnId(containerId) {
  const separatorIndex = String(containerId).lastIndexOf(columnSeparator);
  if (separatorIndex < 1) return null;
  const columnIndex = Number(String(containerId).slice(separatorIndex + columnSeparator.length));
  if (!Number.isInteger(columnIndex) || columnIndex < 0) return null;
  return { layoutId: String(containerId).slice(0, separatorIndex), columnIndex };
}

function normalizedBlocks(blocks) {
  return Array.isArray(blocks) ? blocks : [];
}

export function flattenEmailBlocks(blocks, includeLayouts = false) {
  const flattened = [];
  normalizedBlocks(blocks).forEach((block) => {
    if (includeLayouts || block.type !== "layout") flattened.push(block);
    if (block.type === "layout") {
      normalizedBlocks(block.columns).forEach((column) => flattened.push(...flattenEmailBlocks(column, includeLayouts)));
    }
  });
  return flattened;
}

export function findEmailBlock(blocks, blockId) {
  for (const block of normalizedBlocks(blocks)) {
    if (block.id === blockId) return block;
    if (block.type === "layout") {
      for (const column of normalizedBlocks(block.columns)) {
        const nested = findEmailBlock(column, blockId);
        if (nested) return nested;
      }
    }
  }
  return null;
}

export function findEmailBlockLocation(blocks, blockId, containerId = ROOT_EMAIL_CONTAINER) {
  for (const [index, block] of normalizedBlocks(blocks).entries()) {
    if (block.id === blockId) return { block, containerId, index };
    if (block.type === "layout") {
      for (const [columnIndex, column] of normalizedBlocks(block.columns).entries()) {
        const nested = findEmailBlockLocation(column, blockId, emailColumnId(block.id, columnIndex));
        if (nested) return nested;
      }
    }
  }
  return null;
}

export function updateEmailBlock(blocks, blockId, patch) {
  return normalizedBlocks(blocks).map((block) => {
    if (block.id === blockId) return { ...block, ...patch };
    if (block.type !== "layout") return block;
    return {
      ...block,
      columns: normalizedBlocks(block.columns).map((column) => updateEmailBlock(column, blockId, patch)),
    };
  });
}

function updateContainer(blocks, containerId, update) {
  if (containerId === ROOT_EMAIL_CONTAINER) return update(normalizedBlocks(blocks));
  const target = parseColumnId(containerId);
  if (!target) return normalizedBlocks(blocks);
  return normalizedBlocks(blocks).map((block) => {
    if (block.id === target.layoutId && block.type === "layout") {
      const columns = normalizedBlocks(block.columns).map((column, index) => (
        index === target.columnIndex ? update(normalizedBlocks(column)) : column
      ));
      return { ...block, columns };
    }
    if (block.type !== "layout") return block;
    return {
      ...block,
      columns: normalizedBlocks(block.columns).map((column) => updateContainer(column, containerId, update)),
    };
  });
}

export function insertEmailBlock(blocks, containerId, targetIndex, block) {
  return updateContainer(blocks, containerId, (container) => {
    const next = [...container];
    const index = Math.min(next.length, Math.max(0, Number(targetIndex) || 0));
    next.splice(index, 0, block);
    return next;
  });
}

export function removeEmailBlock(blocks, blockId) {
  const location = findEmailBlockLocation(blocks, blockId);
  if (!location) return { blocks: normalizedBlocks(blocks), block: null, containerId: null, index: -1 };
  const next = updateContainer(blocks, location.containerId, (container) => container.filter((block) => block.id !== blockId));
  return { blocks: next, block: location.block, containerId: location.containerId, index: location.index };
}

export function moveEmailBlock(blocks, blockId, targetContainerId, targetIndex) {
  const source = findEmailBlockLocation(blocks, blockId);
  if (!source) return normalizedBlocks(blocks);
  if (source.block.type === "layout" && String(targetContainerId).startsWith(`${source.block.id}${columnSeparator}`)) {
    return normalizedBlocks(blocks);
  }
  const removed = removeEmailBlock(blocks, blockId);
  let adjustedIndex = Number(targetIndex) || 0;
  if (source.containerId === targetContainerId && source.index < adjustedIndex) adjustedIndex -= 1;
  if (source.containerId === targetContainerId && source.index === adjustedIndex) return normalizedBlocks(blocks);
  return insertEmailBlock(removed.blocks, targetContainerId, adjustedIndex, removed.block);
}
