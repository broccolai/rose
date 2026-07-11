import { handleTokenLogout } from '../../../_lib/bungie-oauth';

export const onRequestPost = (): Response => handleTokenLogout();
