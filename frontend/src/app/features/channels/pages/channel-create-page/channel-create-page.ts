import { Component } from '@angular/core';

import { ChannelForm } from '../../components/channel-form/channel-form';

@Component({
  selector: 'app-channel-create-page',
  standalone: true,
  imports: [ChannelForm],
  template: '<app-channel-form mode="create" />',
})
export class ChannelCreatePage {}
