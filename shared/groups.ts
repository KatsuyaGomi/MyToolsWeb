export interface UserGroup {
  id: string;
  name: string;
}

export interface ManagedGroup extends UserGroup {
  memberCount: number;
}

export interface GroupMembership {
  userId: string;
  groupId: string;
}

export interface GroupDirectory {
  revision: number;
  groups: ManagedGroup[];
  memberships: GroupMembership[];
}
