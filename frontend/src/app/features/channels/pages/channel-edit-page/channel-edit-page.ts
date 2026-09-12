import { Component } from '@angular/core';

import { ChannelForm } from '../../components/channel-form/channel-form';

@Component({
  selector: 'app-channel-edit-page',
  standalone: true,
  imports: [ChannelForm],
  template: '<app-channel-form mode="edit" />',
})
export class ChannelEditPage {}
