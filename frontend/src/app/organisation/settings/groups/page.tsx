"use client";

import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/utils/api";

type OrgGroup = {
  id: number;
  parent_id: number | null;
  key: string;
  value: string;
};

export default function HierarchyBuilder() {
  const [groups, setGroups] = useState<OrgGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGroup, setNewGroup] = useState({ parent_id: null as number | null, key: "", value: "" });

  const loadGroups = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/org/groups");
      if (res.ok) {
        setGroups(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetchWithAuth("/api/org/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newGroup)
      });
      if (res.ok) {
        setNewGroup({ parent_id: null, key: "", value: "" });
        loadGroups();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this group and all its sub-groups?")) return;
    try {
      const res = await fetchWithAuth(`/api/org/groups/${id}`, { method: "DELETE" });
      if (res.ok) loadGroups();
    } catch (e) {
      console.error(e);
    }
  };

  // Build tree from flat list
  const buildTree = (parentId: number | null): any[] => {
    return groups
      .filter(g => g.parent_id === parentId)
      .map(g => ({ ...g, children: buildTree(g.id) }));
  };

  const tree = buildTree(null);

  const renderTree = (nodes: any[], depth = 0) => {
    if (nodes.length === 0) return null;
    return (
      <div className={`space-y-3 ${depth > 0 ? "ml-6 pl-4 border-l-2 border-outline-variant/30" : ""}`}>
        {nodes.map(node => (
          <div key={node.id} className="mt-2">
            <div className="flex items-center justify-between bg-surface-container-lowest border border-outline-variant p-3 rounded-lg shadow-sm hover:border-secondary transition-colors group">
              <div className="flex items-center gap-3">
                <span className="bg-secondary-container/50 text-on-secondary-container text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">
                  {node.key}
                </span>
                <span className="font-medium text-on-surface">{node.value}</span>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => setNewGroup({ parent_id: node.id, key: "", value: "" })}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  + Add Sub-group
                </button>
                <button 
                  onClick={() => handleDelete(node.id)}
                  className="text-xs font-medium text-error hover:underline ml-2"
                >
                  Delete
                </button>
              </div>
            </div>
            {renderTree(node.children, depth + 1)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-primary">Academic Structure</h1>
        <p className="text-on-surface-variant mt-2">
          Design your organization's hierarchy (e.g., Branch &rarr; Department &rarr; Semester). There is no fixed structure; build it exactly how your institution operates.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Hierarchy Tree */}
        <div className="md:col-span-2 bg-surface rounded-2xl border border-outline-variant p-6 shadow-sm min-h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-on-surface">Organization Tree</h2>
            <button 
              onClick={() => setNewGroup({ parent_id: null, key: "Branch", value: "" })}
              className="bg-primary text-on-primary px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              + Top Level Group
            </button>
          </div>
          
          {loading ? (
            <p className="text-on-surface-variant">Loading structure...</p>
          ) : tree.length === 0 ? (
            <div className="text-center p-8 border-2 border-dashed border-outline-variant rounded-xl text-on-surface-variant">
              No structure defined. Click "+ Top Level Group" to start building.
            </div>
          ) : (
            renderTree(tree)
          )}
        </div>

        {/* Add/Edit Form */}
        <div className="bg-surface rounded-2xl border border-outline-variant p-6 shadow-sm h-fit sticky top-8">
          <h2 className="text-lg font-bold text-on-surface mb-4">
            {newGroup.parent_id === null ? "Add Top Level Group" : "Add Sub-group"}
          </h2>
          {newGroup.parent_id !== null && (
            <p className="text-xs text-on-surface-variant mb-4 bg-surface-container p-2 rounded">
              Adding under parent ID: {newGroup.parent_id}
            </p>
          )}
          
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">Group Key (Category)</label>
              <input 
                type="text" required
                placeholder="e.g. Branch, Department, Year"
                value={newGroup.key} onChange={e => setNewGroup({...newGroup, key: e.target.value})}
                className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:border-secondary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">Group Value (Name)</label>
              <input 
                type="text" required
                placeholder="e.g. Engineering, CSE, Semester 5"
                value={newGroup.value} onChange={e => setNewGroup({...newGroup, value: e.target.value})}
                className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:border-secondary"
              />
            </div>
            
            <div className="pt-4 flex justify-end gap-3">
              {newGroup.parent_id !== null && (
                <button type="button" onClick={() => setNewGroup({ parent_id: null, key: "", value: "" })} className="px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container rounded-lg">
                  Cancel
                </button>
              )}
              <button type="submit" className="w-full px-4 py-2 bg-secondary text-white text-sm font-medium rounded-lg hover:bg-secondary/90 transition-colors">
                Save Group
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
