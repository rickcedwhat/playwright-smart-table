# 🚧 Roadmap (v2.2+)

This document tracks planned features and enhancements for the Smart Table library.

> **Note**: All implementations are tentative. Features may be modified, re-prioritized, or removed based on community feedback and development constraints.

---

## Planned Features

### `fill` - Intelligent Row Data Entry

**Priority**: Medium  
**Status**: Planned  
**Target Version**: v2.2+

**Goal**: Fill a row with data intelligently, handling different input types automatically.

**Description**:  
A method to populate form fields within a table row. The feature would intelligently detect and interact with various input types (text inputs, selects, checkboxes, custom div-based inputs) without requiring explicit selector configuration.

**Challenges**:
- Handling different input types (select, checkbox, custom divs) blindly
- Dealing with ambiguous inputs when multiple inputs exist in a cell
- Providing flexibility for edge cases

**Proposed API**:
```typescript
await table.fill({ 
  Name: 'John Doe', 
  Status: 'Active',
  IsVerified: true 
});
```

**Implementation Notes**:
- Could leverage `row.getCell(colName)` to find the target cell
- Would need heuristics to determine input type: `input, select, [role="checkbox"]`
- May need to handle ambiguous cases (multiple inputs in a cell) with warnings or options
- Could accept a locator mapper in options for more control: `{ inputMapper: (cell) => cell.locator('custom-selector') }`

---

### `auditPages` - Multi-Page Verification

**Priority**: Low  
**Status**: Planned  
**Target Version**: v2.2+

**Goal**: Walk through multiple pages of a table and run a verification/audit function on every page.

**Description**:  
A utility method for systematically scanning through paginated tables and executing custom validation logic on each page. Useful for end-to-end data integrity checks, validation workflows, and comprehensive table audits.

**Use Cases**:
- Verify all rows meet certain criteria across all pages
- Audit data consistency across paginated results
- Perform batch validation operations

**Proposed API**:
```typescript
await table.auditPages({
  maxPages: 10,
  audit: async (rows: SmartRow[], page: number) => {
    // Custom verification logic
    for (const row of rows) {
      const data = await row.toJSON();
      // Validate data...
    }
  }
});
```

**Implementation Logic**:
```typescript
let page = 1;
while (page <= options.maxPages) {
  const rows = await getAllRows();
  await options.audit(rows, page);
  if (!await pagination(ctx)) break;
  page++;
}
```

**Implementation Notes**:
- Could potentially support skipping pages if the pagination strategy supports it
- Should handle pagination failures gracefully
- May want to support early termination if the audit function returns a signal
- Consider adding progress callbacks for long-running audits

---

## Version History

- **v2.1.3** (Current): Enhanced documentation with type references, headerTransformer examples, compatibility test suite
- **v2.1.2**: Core table functionality, pagination strategies, SmartRow pattern
- **v2.2+** (Planned): New features listed above

---

## Contributing

If you're interested in implementing any of these features or have suggestions for improvements, please:
1. Open an issue to discuss the approach
2. Submit a pull request with your implementation
3. Include tests and documentation updates

