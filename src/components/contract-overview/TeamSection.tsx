import { Users } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface TeamSectionProps {
  data: any;
  provenance: any;
}

export const TeamSection = ({ data, provenance }: TeamSectionProps) => {
  const equipo = Array.isArray(data.equipo) ? data.equipo : 
                Array.isArray(data.personal_clave) ? data.personal_clave : [];

  if (equipo.length === 0) return null;

  return (
    <div className="bg-card border rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        Equipo de Proyecto
      </h2>
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Especialidad</TableHead>
              <TableHead>Contacto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {equipo.map((member, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">
                  {member.nombre || member.name || "-"}
                </TableCell>
                <TableCell>
                  {member.cargo || member.rol || member.role || "-"}
                </TableCell>
                <TableCell>
                  {member.especialidad || member.profesion || member.specialty || "-"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {member.email || member.contacto || "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
