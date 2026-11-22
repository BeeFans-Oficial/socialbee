import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Link } from "../links/entities/link.entity";
import { Domain } from "./entities/domain.entity";
import { PageOwner } from "./entities/page-owner.entity";
import { Profile } from "./entities/profile.entity";
import { CustomDomainsController } from "./custom-domains.controller";
import { CustomDomainsService } from "./custom-domains.service";
import { DomainsController } from "./domains.controller";
import { MyProfilesController } from "./my-profiles.controller";
import { OwnersController } from "./owners.controller";
import { OwnersService } from "./owners.service";
import { ProfileImagesController } from "./profile-images.controller";
import { ProfilesController } from "./profiles.controller";
import { ProfilesService } from "./profiles.service";
import { PublicProfilesController } from "./public-profiles.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Profile, PageOwner, Domain, Link])],
  controllers: [
    ProfilesController,
    ProfileImagesController,
    MyProfilesController,
    OwnersController,
    DomainsController,
    CustomDomainsController,
    PublicProfilesController,
  ],
  providers: [ProfilesService, OwnersService, CustomDomainsService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
