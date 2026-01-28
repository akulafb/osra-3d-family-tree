# Graph Data Structures for Family Trees

## Graph Theory Basics

A **graph** = Set of **nodes** (vertices) + Set of **links** (edges) connecting them.

- **Undirected**: Links have no direction (A-B same as B-A)
- **Directed**: Links have direction (A→B different from B→A)
- **Weighted**: Links have values (e.g., relationship strength)
- **Labeled**: Links have types/categories

## Modeling Family Relationships

Family trees are **directed graphs** with **labeled links**:

### Node (Person)
- Unique identifier (id)
- Attributes: name, birthDate, birthPlace
- Optional: familyCluster (for visual grouping)

### Link Types

1. **Parent Link** (directed: parent → child)
   - Represents parent-child relationship
   - Directional: flows from older to younger generation
   - Creates family tree hierarchy

2. **Sibling Link** (undirected or bidirectional)
   - Connects siblings (same parents)
   - Can be implicit (via shared parents) or explicit
   - Creates horizontal family connections

3. **Marriage Link** (undirected)
   - Connects spouses
   - **Key**: Bridges different family clusters (different surnames)
   - Creates the 3D spatial separation we want

## Data Structure

```typescript
{
  nodes: [
    { id: 1, name: "John Badran", birthDate: "1950-03-15", birthPlace: "Amman" },
    { id: 2, name: "Mary Smith", birthDate: "1952-07-20", birthPlace: "London" }
  ],
  links: [
    { source: 1, target: 3, type: "parent" },      // John → Child
    { source: 2, target: 3, type: "parent" },      // Mary → Child
    { source: 1, target: 2, type: "marriage" },    // John ↔ Mary
    { source: 3, target: 4, type: "sibling" }     // Siblings
  ]
}
```

## Important Considerations

### Source/Target References
- Links reference nodes by `id` (not object reference)
- `source` and `target` can be:
  - Number/string (node id)
  - Node object (library handles both)

### Link Direction
- **Parent links**: Must be parent → child (for arrows/visualization)
- **Marriage links**: Undirected (both directions equivalent)
- **Sibling links**: Can be either direction

### Data Validation
- All link sources/targets must exist in nodes array
- No self-loops (node linking to itself)
- Marriage links should connect different family clusters
- Parent links should respect generational hierarchy

### Family Clusters
- Clusters = groups of nodes with same surname or explicit grouping
- Marriage links connect clusters
- Force simulation will naturally separate clusters in 3D space
- Can be explicit (familyCluster property) or inferred (from surname)

## For Our Project

We'll:
- Use TypeScript interfaces for type safety
- Validate data integrity (all links reference valid nodes)
- Style links differently based on type
- Use marriage links to identify cluster boundaries
- Configure force simulation to respect cluster separation
