import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

/** O painel de operação da plataforma. Só para contas com `role = 'admin'`. */
@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
