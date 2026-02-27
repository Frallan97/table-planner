import { useState, useEffect } from "react";
import { api, type OrganizationWithRole, type OrganizationMember, type OrganizationInvitation } from "@/lib/api";
import { X, Plus, Building2, Users, Mail, Loader2, Trash2, Shield, Eye, UserCog } from "lucide-react";

interface OrganizationManagerProps {
  onClose: () => void;
}

export function OrganizationManager({ onClose }: OrganizationManagerProps) {
  const [organizations, setOrganizations] = useState<OrganizationWithRole[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const orgs = await api.listOrganizations();
      setOrganizations(orgs);
    } catch (err) {
      console.error("Failed to fetch organizations:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    setCreating(true);
    try {
      const newOrg = await api.createOrganization(newOrgName.trim());
      await fetchOrganizations();
      setSelectedOrg(newOrg.id);
      setShowCreateOrg(false);
      setNewOrgName("");
    } catch (err) {
      console.error("Failed to create organization:", err);
      alert("Failed to create organization. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteOrg = async (orgId: string, orgName: string) => {
    if (!confirm(`Are you sure you want to delete "${orgName}"? All shared floor plans will become personal.`)) {
      return;
    }
    try {
      await api.deleteOrganization(orgId);
      setOrganizations((prev) => prev.filter((o) => o.id !== orgId));
      if (selectedOrg === orgId) {
        setSelectedOrg(null);
      }
    } catch (err) {
      console.error("Failed to delete organization:", err);
      alert("Failed to delete organization. Please try again.");
    }
  };

  const selectedOrgData = organizations.find((o) => o.id === selectedOrg);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-background rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            <h2 className="text-xl font-semibold">Organization Manager</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - Organization List */}
          <div className="w-64 border-r overflow-y-auto">
            <div className="p-4">
              <button
                onClick={() => setShowCreateOrg(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Organization
              </button>
            </div>

            {showCreateOrg && (
              <div className="px-4 pb-4">
                <div className="border rounded-lg p-3 bg-card">
                  <input
                    type="text"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateOrg()}
                    placeholder="Organization name..."
                    className="w-full px-2 py-1 border rounded text-sm mb-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateOrg}
                      disabled={creating || !newOrgName.trim()}
                      className="flex-1 px-2 py-1 bg-primary text-primary-foreground rounded text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
                    >
                      {creating ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "Create"}
                    </button>
                    <button
                      onClick={() => {
                        setShowCreateOrg(false);
                        setNewOrgName("");
                      }}
                      className="flex-1 px-2 py-1 border rounded text-xs hover:bg-muted"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : organizations.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No organizations yet
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {organizations.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => setSelectedOrg(org.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedOrg === org.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    <div className="font-medium truncate">{org.name}</div>
                    <div className={`text-xs ${selectedOrg === org.id ? "opacity-90" : "text-muted-foreground"}`}>
                      Role: {org.role}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Main Content - Organization Details */}
          <div className="flex-1 overflow-y-auto">
            {!selectedOrg ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-lg font-medium">Select an organization</p>
                  <p className="text-sm">Choose an organization to view its details and members</p>
                </div>
              </div>
            ) : selectedOrgData ? (
              <OrganizationDetails
                organization={selectedOrgData}
                onDelete={() => handleDeleteOrg(selectedOrgData.id, selectedOrgData.name)}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

interface OrganizationDetailsProps {
  organization: OrganizationWithRole;
  onDelete: () => void;
}

function OrganizationDetails({ organization, onDelete }: OrganizationDetailsProps) {
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">("member");
  const [inviting, setInviting] = useState(false);

  const canManage = organization.role === "owner" || organization.role === "admin";

  useEffect(() => {
    fetchMembersAndInvitations();
  }, [organization.id]);

  const fetchMembersAndInvitations = async () => {
    setLoading(true);
    try {
      const membersData = await api.listOrgMembers(organization.id);
      setMembers(membersData);
      // Note: We would need an endpoint to list pending invitations
      // For now, we'll leave invitations empty
      setInvitations([]);
    } catch (err) {
      console.error("Failed to fetch members:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await api.inviteMember(organization.id, inviteEmail.trim(), inviteRole);
      await fetchMembersAndInvitations();
      setShowInvite(false);
      setInviteEmail("");
      setInviteRole("member");
      alert(`Invitation sent to ${inviteEmail}`);
    } catch (err) {
      console.error("Failed to invite member:", err);
      alert("Failed to send invitation. Please try again.");
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string, memberRole: string) => {
    if (memberRole === "owner") {
      alert("Cannot remove the organization owner.");
      return;
    }
    if (!confirm("Are you sure you want to remove this member?")) {
      return;
    }
    try {
      await api.removeMember(organization.id, memberId);
      setMembers((prev) => prev.filter((m) => m.userId !== memberId));
    } catch (err) {
      console.error("Failed to remove member:", err);
      alert("Failed to remove member. Please try again.");
    }
  };

  const handleUpdateRole = async (memberId: string, currentRole: string) => {
    if (currentRole === "owner") {
      alert("Cannot change the owner's role.");
      return;
    }

    const newRole = prompt(`Enter new role for this member (owner/admin/member/viewer):`, currentRole);
    if (!newRole || newRole === currentRole) return;

    if (!["owner", "admin", "member", "viewer"].includes(newRole)) {
      alert("Invalid role. Must be owner, admin, member, or viewer.");
      return;
    }

    try {
      await api.updateMemberRole(organization.id, memberId, newRole);
      setMembers((prev) =>
        prev.map((m) => (m.userId === memberId ? { ...m, role: newRole } : m))
      );
    } catch (err) {
      console.error("Failed to update role:", err);
      alert("Failed to update member role. Please try again.");
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return <Shield className="w-4 h-4 text-yellow-500" />;
      case "admin":
        return <UserCog className="w-4 h-4 text-blue-500" />;
      case "member":
        return <Users className="w-4 h-4 text-green-500" />;
      case "viewer":
        return <Eye className="w-4 h-4 text-gray-500" />;
      default:
        return <Users className="w-4 h-4" />;
    }
  };

  return (
    <div className="p-6">
      {/* Organization Header */}
      <div className="mb-6">
        <h3 className="text-2xl font-semibold mb-2">{organization.name}</h3>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            {getRoleIcon(organization.role)}
            Your role: <span className="font-medium">{organization.role}</span>
          </span>
          <span>Created: {new Date(organization.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-6">
        {canManage && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Mail className="w-4 h-4" />
            Invite Member
          </button>
        )}
        {organization.role === "owner" && (
          <button
            onClick={onDelete}
            className="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete Organization
          </button>
        )}
      </div>

      {/* Invite Form */}
      {showInvite && (
        <div className="border rounded-lg p-4 mb-6 bg-card">
          <h4 className="font-medium mb-3">Invite New Member</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="member@example.com"
                className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "admin" | "member" | "viewer")}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="viewer">Viewer (read-only)</option>
                <option value="member">Member (can edit)</option>
                <option value="admin">Admin (can manage members)</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Invitation"}
              </button>
              <button
                onClick={() => {
                  setShowInvite(false);
                  setInviteEmail("");
                  setInviteRole("member");
                }}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Members List */}
      <div className="mb-6">
        <h4 className="font-medium mb-3">Members ({members.length})</h4>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No members yet
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.userId}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getRoleIcon(member.role)}
                  <div>
                    <div className="font-medium text-sm">
                      {member.email || member.userId}
                    </div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {member.role}
                    </div>
                  </div>
                </div>
                {canManage && member.role !== "owner" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdateRole(member.userId, member.role)}
                      className="px-2 py-1 text-xs border rounded hover:bg-muted"
                    >
                      Change Role
                    </button>
                    <button
                      onClick={() => handleRemoveMember(member.userId, member.role)}
                      className="px-2 py-1 text-xs text-destructive hover:bg-destructive/10 rounded"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
