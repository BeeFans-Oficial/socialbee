import { Module } from "@nestjs/common";


import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

/** O painel de operação da plataforma. Só para contas com `role = 'admin'`. */
@Module({
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
