import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Link } from "../links/entities/link.entity";
import { Domain } from "./entities/domain.entity";
import { Profile } from "./entities/profile.entity";
import { AvatarController } from "./avatar.controller";
import { CustomDomainsController } from "./custom-domains.controller";
import { CustomDomainsService } from "./custom-domains.service";
import { DomainsController } from "./domains.controller";
import { MyProfilesController } from "./my-profiles.controller";
import { ProfilesController } from "./profiles.controller";
import { ProfilesService } from "./profiles.service";
import { PublicProfilesController } from "./public-profiles.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Profile, Domain, Link])],
  controllers: [
    ProfilesController,
    MyProfilesController,
    DomainsController,
    CustomDomainsController,
    PublicProfilesController,
    AvatarController,
  ],
  providers: [ProfilesService, CustomDomainsService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
