
import UserManagement from "@/components/admin/user-management";
import { mockAdminUsers } from "@/lib/mock-data";

export default function UsersPage() {
    return (
        <div className="grid gap-4">
           <UserManagement users={mockAdminUsers} />
        </div>
    );
}
