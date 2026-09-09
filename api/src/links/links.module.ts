import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { LinkCounter } from "../tracking/entities/link-counter.entity";
import { Link } from "./entities/link.entity";
import { SafePage } from "./entities/safe-page.entity";
import { SafePageSocialLink } from "./entities/safe-page-social-link.entity";
import { LinkOwnerGuard } from "./link-owner.guard";
import { LinksController } from "./links.controller";
import { LinksService } from "./links.service";

@Module({
  imports: [TypeOrmModule.forFeature([Link, SafePage, SafePageSocialLink, LinkCounter])],
  controllers: [LinksController],
  providers: [LinksService, LinkOwnerGuard],
  exports: [LinksService],
})
export class LinksModule {}
